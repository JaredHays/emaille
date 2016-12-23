package emaille

import (
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
	"google.golang.org/appengine/user"
)

type Sheet struct {
	Data        string `datastore:",noindex"`
	Author      string
	Units       string   `datastore:",noindex"`
	EdgeRings   []string `datastore:",noindex"`
	ColorCounts string   `datastore:",noindex"`
	Weave       string
	Created     time.Time
	Updated     time.Time
}

func (sheet *Sheet) String() string {
	json, _ := json.Marshal(sheet)
	return string(json)
}

func init() {
	http.HandleFunc("/maille/", maille)
	http.HandleFunc("/data/getwires", getWires)
	http.HandleFunc("/datastore/load", loadSheet)
	http.HandleFunc("/datastore/save", saveSheet)
}

func maille(resp http.ResponseWriter, req *http.Request) {
	http.ServeFile(resp, req, "./www/index.html")
}

func getWires(resp http.ResponseWriter, req *http.Request) {
	//ctxt := appengine.NewContext(req)

	_, err := storage.NewClient(context.Background())
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}
}

func saveSheet(resp http.ResponseWriter, req *http.Request) {
	ctxt := appengine.NewContext(req)

	var key *datastore.Key
	var sheet *Sheet

	var edgeRings []string
	json.Unmarshal([]byte(req.FormValue("edgeRings")), &edgeRings)

	keyString := req.FormValue("key")
	log.Debugf(ctxt, keyString)

	// Existing sheet, attempt to locate and update
	if keyString != "" {
        log.Debugf(ctxt, "Updating sheet")
		var err error
		key, sheet, err = loadSheetFromDB(ctxt, fromBase62(keyString))
		if err == nil {
			sheet.Data = req.FormValue("sheet")
			sheet.Units = req.FormValue("units")
			sheet.EdgeRings = edgeRings
			sheet.Updated = time.Now()
            log.Debugf(ctxt, "Updated?: %v", sheet.Updated)
		} else {
			//log.Errorf(ctxt, "Error updating sheet: " + err.Error())
		}
		//log.Debugf(ctxt, "Sheet updated: " + sheet.String())
	} else {
		key = datastore.NewIncompleteKey(ctxt, "Sheet", nil)
		sheet = &Sheet{
			Data:        req.FormValue("sheet"),
			Units:       req.FormValue("units"),
			Weave:       req.FormValue("weave"),
			EdgeRings:   edgeRings,
			ColorCounts: req.FormValue("colorCounts"),
			Created:     time.Now(),
			Updated:     time.Now(),
		}

		if u := user.Current(ctxt); u != nil {
			sheet.Author = u.String()
		}
	}

    log.Debugf(ctxt, "Now: %v", time.Now())
	log.Debugf(ctxt, "Saving sheet: %v", sheet.Updated)
	key, err := datastore.Put(ctxt, key, sheet)

	if err != nil {
		// resp.Write([]byte(err.Error()))
		log.Errorf(ctxt, "Error saving sheet: "+err.Error())
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Debugf(ctxt, fmt.Sprintf("%d", key.IntID()))
	resp.Write([]byte(toBase62(key.IntID())))
	// http.Redirect(resp, req, "/maille/", http.StatusFound)
}

func loadSheet(resp http.ResponseWriter, req *http.Request) {
	ctxt := appengine.NewContext(req)

	log.Debugf(ctxt, strconv.FormatInt(fromBase62(req.FormValue("key")), 10))

	//key := datastore.NewKey(ctxt, "Sheet", "", fromBase62(req.FormValue("key")), nil)
	//sheet := new(Sheet)
	//if err := datastore.Get(ctxt, key, sheet); err != nil {
	_, sheet, err := loadSheetFromDB(ctxt, fromBase62(req.FormValue("key")))
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
		return
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
	//if err != nil {
	//    log.Debugf(ctxt, sheet.Weave)
	//	return sheet, err
	//}
	//log.Debugf(ctxt, "Loaded sheet from db: " + sheet.String())
	if key == nil {
		log.Debugf(ctxt, "nil key")
	} else {
		log.Debugf(ctxt, "non-nil key")
	}
	if sheet == nil {
		log.Debugf(ctxt, "nil sheet")
	} else {
		log.Debugf(ctxt, "non-nil sheet")
	}
	if err == nil {
		log.Debugf(ctxt, "nil err")
	} else {
		log.Debugf(ctxt, "non-nil err")
	}
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
