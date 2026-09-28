// Package the canonical PNG rendered from app/ui/mark.svg by render-brand.mjs.
package main

import (
	"bytes"
	"image/png"
	"log"
	"os"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: appicon OUTPUT.png (run from repository root)")
	}
	data, err := os.ReadFile("app/build/icon.png")
	if err != nil {
		log.Fatal(err)
	}
	if _, err := png.Decode(bytes.NewReader(data)); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(os.Args[1], data, 0644); err != nil {
		log.Fatal(err)
	}
}
