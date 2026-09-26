// Native integration probe: run under a graphical session or xvfb-run.
package main

import (
	"fmt"
	"log"
	"os"
	"sync/atomic"
	"time"

	"github.com/mannders00/OrbitalNote/app/ui"
	"github.com/mannders00/OrbitalNote/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: native-smoke WORKSPACE")
	}
	s := workspace.NewService()
	defer s.Close()
	if _, err := s.Open(os.Args[1]); err != nil {
		log.Fatal(err)
	}
	app := application.New(application.Options{Name: "OrbitalNote native probe", Services: []application.Service{application.NewService(s)}, Assets: application.AssetOptions{Handler: application.AssetFileServerFS(ui.Assets)}})
	var passed atomic.Bool
	app.Event.On("probe:result", func(e *application.CustomEvent) {
		log.Printf("Native probe: %#v", e.Data)
		if data, ok := e.Data.(map[string]any); ok {
			if success, ok := data["ok"].(bool); ok && success {
				passed.Store(true)
			}
		}
		app.Quit()
	})
	w := app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "Native integration probe", Width: 1200, Height: 800, URL: "/"})
	w.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		w.ExecJS(`(async () => {
 const {Call, Events} = await import('/wails/runtime.js');
 try {
   const state = await Call.ByName('github.com/mannders00/OrbitalNote/internal/workspace.Service.Status');
   const entries = await Call.ByName('github.com/mannders00/OrbitalNote/internal/workspace.Service.Agenda', state.id);
   let attempts = 0;
   const check = () => {
     const agenda = document.getElementById('agenda');
     if (agenda && !agenda.hidden && document.querySelector('.agenda-entry')) {
       Events.Emit('probe:result', {ok: state.id > 0 && entries.length > 0, name:state.name, entries:entries.length});
     } else if (++attempts < 100) setTimeout(check,100);
     else Events.Emit('probe:result',{ok:false,error:document.body.innerText});
   };
   check();
 } catch(error) { Events.Emit('probe:result',{ok:false,error:String(error)}); }
})()`)
	})
	timer := time.AfterFunc(60*time.Second, func() { log.Print("native probe timed out"); app.Quit() })
	defer timer.Stop()
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
	if !passed.Load() {
		os.Exit(1)
	}
	fmt.Println("PASS: Wails v3 WebView loaded UI, called Go bindings, and rendered the agenda.")
}
