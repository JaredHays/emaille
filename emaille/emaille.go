package emaille

import (
	"encoding/json"
	"fmt"
	"strconv"
	"net/http"
	"time"

	"cloud.google.com/go/storage"
	"golang.org/x/net/context"
	"google.golang.org/appengine"
	"google.golang.org/appengine/datastore"
	"google.golang.org/appengine/log"
	"google.golang.org/appengine/user"
)

type Sheet struct {
	Data      string `datastore:",noindex"`
	Author    string
	Units     string   `datastore:",noindex"`
	EdgeRings []string `datastore:",noindex"`
	Weave     string
	Created   time.Time
	Updated   time.Time
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

	var edgeRings []string
	// log.Debugf(ctxt, "edgeRings: " + req.FormValue("edgeRings"))
	json.Unmarshal([]byte(req.FormValue("edgeRings")), &edgeRings)
	sheet := &Sheet{
		Data: req.FormValue("sheet"),
		Units: req.FormValue("units"),
		Weave: req.FormValue("weave"),
		EdgeRings: edgeRings,
		Created: time.Now(),
		Updated: time.Now(),
	}
	if u := user.Current(ctxt); u != nil {
		sheet.Author = u.String()
	}

	key, err := datastore.Put(ctxt, datastore.NewIncompleteKey(ctxt, "Sheet", nil), sheet)

	if err != nil {
		// resp.Write([]byte(err.Error()))
		log.Errorf(ctxt, err.Error())
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
	
	key := datastore.NewKey(ctxt, "Sheet", "", fromBase62(req.FormValue("key")), nil)
	sheet := new(Sheet)
	if err := datastore.Get(ctxt, key, sheet); err != nil {
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
