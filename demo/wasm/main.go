//go:build js && wasm

package main

import (
	"syscall/js"
	"time"

	"github.com/mannders00/OrbitalNote/demo"
)

func main() {
	// The worker supplies local civil time because Go's WASM timezone may be UTC.
	now, err := time.Parse("2006-01-02", js.Global().Get("demoToday").String())
	if err != nil {
		now = time.Now()
	}
	s, err := demo.NewService(now)
	if err != nil {
		js.Global().Call("demoFailed", err.Error())
		return
	}
	call := js.FuncOf(func(this js.Value, args []js.Value) any { return demo.JSON(s, args[0].String()) })
	js.Global().Set("demoCall", call)
	js.Global().Call("demoReady")
	select {}
}
