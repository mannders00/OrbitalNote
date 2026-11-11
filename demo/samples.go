package demo

import (
	"fmt"
	"time"
)

// Dates are seeded from the visitor's local civil day, not the build date.
func Samples(now time.Time) map[string]string {
	stamp := func(offset int) string { return now.AddDate(0, 0, offset).Format("2006-01-02 Mon") }
	return map[string]string{
		"Welcome.org": `#+TITLE: A little space to think
#+FILETAGS: :welcome:

* Welcome to your demo workspace
This is the real OrbitalNote editor, running locally in your browser.
Try changing a note, completing a task, or moving an event in Calendar.

Everything here is disposable: refreshing resets notes, preferences, and views.
No account, syncing, uploads, or connection to your own files.

* Take a look around
- Open [[file:Launch.org][the launch plan]] to see notes and tasks together.
- Visit [[file:Today.org][today's notebook]] for a few ideas.
- Try Agenda and Calendar in the left ribbon.
- Switch between source and reading view, or pick another theme in Settings.

* A simple project
| Step | Outcome |
|------+---------|
| Think | Find a useful idea |
| Plan | Make room for it |
| Do | Take the next step |

* TODO Make this workspace your own :tryit:
Edit this heading. Add a sentence. It's okay to experiment.
`,
		"Launch.org": fmt.Sprintf(`#+TITLE: A thoughtful launch
#+FILETAGS: :project:

* A calmer way to plan
Keep the next step close to the thinking behind it.
See also [[file:Today.org][today's notes]].

* TODO Sketch the first version :design:
SCHEDULED: <%s 09:00-10:00>
- [X] Collect a few references
- [ ] Write down the core idea
- [ ] Make one useful sketch

** TODO Ask for a second opinion
Keep this nested task when you experiment with deleting its parent.

* TODO Build a small prototype :focus:
SCHEDULED: <%s 11:00-12:00>
Start small. Leave room to learn.

* Review with the team
<%s 14:00-14:45>
Bring a working example and one open question.

* TODO Share the next iteration :writing:
DEADLINE: <%s>

* DONE Choose a direction
CLOSED: [%s 16:00]
Small, useful, and easy to understand.
`, stamp(0), stamp(1), stamp(0), stamp(3), stamp(-1)),
		"Today.org": fmt.Sprintf(`#+TITLE: Today, with a little more space
#+FILETAGS: :personal:

* Morning notes
What would make today feel worthwhile?

* TODO Read a chapter :reading:
SCHEDULED: <%s 08:00-08:30>

* A walk outside
<%s 12:30-13:00>
Leave the phone in your pocket.

* TODO Make a plan for the weekend
SCHEDULED: <%s>

* Ideas to revisit
- A tiny garden by the window
- A recipe worth sharing
- A note to an old friend
`, stamp(0), stamp(0), stamp(2)),
	}
}
