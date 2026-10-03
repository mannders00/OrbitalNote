// Vim lives beside CodeMirror so motions, undo, dot-repeat, and macros share
// the editor's transaction model rather than simulating textarea keystrokes.
export function attachVi(editor, status) {
  return editor.attachVi(status);
}
