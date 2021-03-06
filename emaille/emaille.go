package emaille

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"cloud.google.com/go/storage"
	"golang.org/x/net/context"
	"google.golang.org/appengine"
	"google.golang.org/appengine/datastore"
	"google.golang.org/appengine/log"
	"google.golang.org/appengine/mail"
	"google.golang.org/appengine/urlfetch"
)

// var serviceAcct = "e-maille@appspot.gserviceaccount.com"
var destAcct = "jared.hays@gmail.com"

type Sheet struct {
	RingData  []byte    `datastore:",noindex" json:"-"`
	Rings     string    `datastore:"-,noindex" json:"rings"`
	Author    string    `json:"author"`
	AuthorID  string    `json:"authorID"`
	Units     string    `datastore:",noindex" json:"units"`
	EdgeData  []byte    `datastore:",noindex" json:"-"`
	EdgeRings string    `datastore:"-,noindex" json:"edgeRings"`
	Weave     string    `json:"weave"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

func (orig *Sheet) Clone() *Sheet {
	var sheet = &Sheet{
		RingData: orig.RingData,
		Units:    orig.Units,
		Weave:    orig.Weave,
		EdgeData: orig.EdgeData,
		Created:  orig.Created,
		Updated:  orig.Updated,
		Author:   orig.Author,
		AuthorID: orig.AuthorID,
	}
	return sheet
}

func (sheet *Sheet) String() string {
	json, _ := json.Marshal(sheet)
	return string(json)
}

// Compress Rings and EdgeRings to RingData and EdgeData
func (sheet *Sheet) zipGraph() error {
	buffer := new(bytes.Buffer)
	gz := gzip.NewWriter(buffer)

	if _, err := gz.Write([]byte(sheet.Rings)); err != nil {
		return err
	}
	gz.Close()

	sheet.RingData = buffer.Bytes()

	buffer = new(bytes.Buffer)
	gz = gzip.NewWriter(buffer)

	if _, err := gz.Write([]byte(sheet.EdgeRings)); err != nil {
		return err
	}
	gz.Close()

	sheet.EdgeData = buffer.Bytes()

	return nil
}

// Decompress RingData and EdgeData into Rings and EdgeRings
func (sheet *Sheet) unzipGraph() error {
	buffer := new(bytes.Buffer)
	gz, err := gzip.NewReader(bytes.NewReader(sheet.RingData))
	if err != nil {
		return err
	}

	if _, err := buffer.ReadFrom(gz); err != nil {
		return err
	}

	sheet.Rings = buffer.String()

	buffer = new(bytes.Buffer)
	gz, err = gzip.NewReader(bytes.NewReader(sheet.EdgeData))
	if err != nil {
		return err
	}

	if _, err := buffer.ReadFrom(gz); err != nil {
		return err
	}

	sheet.EdgeRings = buffer.String()

	gz.Close()

	return nil
}

func init() {
	http.HandleFunc("/maille/", func(resp http.ResponseWriter, req *http.Request) {
		http.ServeFile(resp, req, "./www/index.html")
	})
	http.HandleFunc("/contact.html", func(resp http.ResponseWriter, req *http.Request) {
		http.ServeFile(resp, req, "./www/contact.html")
	})
	http.HandleFunc("/contact", contact)
	http.HandleFunc("/data/getwires", getWires)
	http.HandleFunc("/datastore/load", loadSheet)
	http.HandleFunc("/datastore/save", saveSheet)
	http.Handle("/", http.RedirectHandler("/maille/", http.StatusFound))
}

func contact(resp http.ResponseWriter, req *http.Request) {
	ctxt := appengine.NewContext(req)

	log.Infof(ctxt, "type: "+req.PostFormValue("type"))
	log.Infof(ctxt, req.PostFormValue("subject"))
	log.Infof(ctxt, req.PostFormValue("email"))
	log.Infof(ctxt, req.PostFormValue("body"))

	// serviceAcct, err := appengine.ServiceAccount(ctxt)
	// if err != nil {
		// log.Errorf(ctxt, "Couldn't send email: %v", err)
		// http.Error(resp, err.Error(), http.StatusInternalServerError)
	// }

	msg := &mail.Message{
		Sender:  fmt.Sprintf("e-maille <%s>", destAcct),
		To:      []string{destAcct},
		Subject: fmt.Sprintf("[e-maille] %s - %s", req.PostFormValue("type"), req.PostFormValue("subject")),
		Body:    fmt.Sprintf("From: %s\n\n%s", req.PostFormValue("email"), req.PostFormValue("body")),
	}

	if err := mail.Send(ctxt, msg); err != nil {
		log.Errorf(ctxt, "Couldn't send email: %v", err)
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}
}

func getWires(resp http.ResponseWriter, req *http.Request) {
	//ctxt := appengine.NewContext(req)

	_, err := storage.NewClient(context.Background())
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}
}

/**
 * Save a sheet to the datastore. Behavior differs depending on user credentials and current db status of sheet.
 * - No preexisting sheet: Create new sheet owned by current user
 * - Preexisting sheet, same user: Update existing sheet
 * - Preexisting sheet, different user: Clone existing sheet to new sheet owned by current user
 */
func saveSheet(resp http.ResponseWriter, req *http.Request) {
	ctxt := appengine.NewContext(req)

	// Check user token from JavaScript auth
	client := urlfetch.Client(ctxt)
	fetch, err := client.Get("https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + req.PostFormValue("id_token"))
	if err != nil {
		log.Errorf(ctxt, "Error validating user token: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}
	var fetchJSON interface{}
	err = json.NewDecoder(fetch.Body).Decode(&fetchJSON)
	if err != nil {
		log.Errorf(ctxt, "Error parsing authentication response: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}
	fetchMap := fetchJSON.(map[string]interface{})
	if fetchMap["sub"] == nil || fetchMap["email"] == nil {
		log.Errorf(ctxt, "Empty authentication response")
		http.Error(resp, "Empty authentication response", http.StatusInternalServerError)
		return
	}
	id := fetchMap["sub"].(string)
	email := fetchMap["email"].(string)

	var key *datastore.Key
	var sheet *Sheet

	keyString := req.PostFormValue("key")

	// Existing sheet, attempt to locate and update
	if keyString != "" {
		var err error
		key, sheet, err = loadSheetFromDB(ctxt, fromBase62(keyString))
		if err != nil {
			log.Errorf(ctxt, "Error updating sheet: "+err.Error())
			http.Error(resp, err.Error(), http.StatusInternalServerError)
			return
		}

		// Different author, save as new sheet
		if id != sheet.AuthorID {
			key = datastore.NewIncompleteKey(ctxt, "Sheet", nil)
			sheet = sheet.Clone()
		}
	} else {
		// New sheet
		key = datastore.NewIncompleteKey(ctxt, "Sheet", nil)
		sheet = new(Sheet)
		sheet.Created = time.Now()
	}

	sheet.Rings = req.PostFormValue("rings")
	sheet.Units = req.PostFormValue("units")
	sheet.Weave = req.PostFormValue("weave")
	sheet.EdgeRings = req.PostFormValue("edgeRings")
	sheet.Updated = time.Now()
	sheet.Author = email
	sheet.AuthorID = id
	
	if err := sheet.zipGraph(); err != nil {
		log.Errorf(ctxt, "Error zipping graph: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}
	
	key, err = datastore.Put(ctxt, key, sheet)

	if err != nil {
		log.Errorf(ctxt, "Error saving sheet: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Debugf(ctxt, fmt.Sprintf("%d", key.IntID()))
	resp.Write([]byte(toBase62(key.IntID())))
}

/**
 * Load a sheet from the datastore. No credentials required.
 */
func loadSheet(resp http.ResponseWriter, req *http.Request) {
	ctxt := appengine.NewContext(req)

	log.Debugf(ctxt, "Loading key: "+strconv.FormatInt(fromBase62(req.FormValue("key")), 10))

	_, sheet, err := loadSheetFromDB(ctxt, fromBase62(req.FormValue("key")))
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := sheet.unzipGraph(); err != nil {
		log.Errorf(ctxt, "Error unzipping graph: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}

	json, err := json.Marshal(sheet)
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}
	resp.Write(json)
}

func loadSheetFromDB(ctxt context.Context, keyValue int64) (*datastore.Key, *Sheet, error) {
	key := datastore.NewKey(ctxt, "Sheet", "", keyValue, nil)
	sheet := new(Sheet)
	err := datastore.Get(ctxt, key, sheet)
	return key, sheet, err
}

func toBase62(num int64) string {
	const dict = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	s := ""
	for num > 0 {
		mod := num % 62
		s = string(dict[mod]) + s
		num /= 62
	}
	return s
}

func fromBase62(s string) int64 {
	const dict = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	num := int64(0)
	for _, c := range s {
		for i := 0; i < len(dict); i++ {
			if dict[i] == byte(c) {
				num *= 62
				num += int64(i)
				break
			}
		}
	}
	return num
}
