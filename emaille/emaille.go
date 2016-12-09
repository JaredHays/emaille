package emaille

import (
	//"encoding/json"
	"net/http"

	"cloud.google.com/go/storage"
	"golang.org/x/net/context"
	//"google.golang.org/appengine"
)

func init() {
	http.HandleFunc("/data/getwires", getWires)
}

func getWires(resp http.ResponseWriter, req *http.Request) {
	//ctxt := appengine.NewContext(req)

	_, err := storage.NewClient(context.Background())
	if err != nil {
		http.Error(resp, err.Error(), http.StatusInternalServerError)
	}
}
