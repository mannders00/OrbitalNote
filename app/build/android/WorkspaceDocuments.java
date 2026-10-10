package com.wails.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.util.Base64;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** In-place SAF storage. All I/O runs on a Go/JNI worker, never the UI thread. */
public final class WorkspaceDocuments {
    private static final int PICK_TREE = 7312, EXPORT_RECOVERY = 7313, MAX_BYTES = 8 << 20, MAX_ENTRIES = 20000;
    private static final String SETTINGS = ".orbitalnote.org";
    private final Activity activity;
    private final ContentResolver resolver;
    private final Object ioLock = new Object(), pickerLock = new Object();
    private CountDownLatch picker;
    private String pickedTree = "", pickerError = "";
    private native void nativeInstall();

    public WorkspaceDocuments(Activity activity) {
        this.activity = activity; resolver = activity.getContentResolver(); nativeInstall();
    }
    private static final class Failure extends Exception {
        final String code;
        Failure(String code, String text) { super(text); this.code = code; }
    }
    private static final class Entry {
        final Uri uri; final String name, mime; final long flags;
        Entry(Uri uri, String name, String mime, long flags) { this.uri = uri; this.name = name; this.mime = mime; this.flags = flags; }
        boolean directory() { return Document.MIME_TYPE_DIR.equals(mime); }
        void require(long flag, String action) throws Failure {
            if ((flags & flag) == 0) throw new Failure("unsupported", "This folder provider does not support " + action + " for " + name);
        }
    }
    public byte[] dispatch(byte[] request) {
        JSONObject result;
        try {
            JSONObject q = new JSONObject(new String(request, StandardCharsets.UTF_8));
            if (q.getString("op").equals("choose")) result = choose();
            else synchronized (ioLock) { result = perform(q); }
        } catch (Exception error) {
            result = new JSONObject();
            try {
                result.put("code", error instanceof Failure ? ((Failure) error).code : "io");
                result.put("error", error instanceof SecurityException
                    ? "Folder permission was lost. Use Open workspace to select the same folder again."
                    : error.getMessage() == null ? "Folder provider is unavailable. Reconnect it and retry." : error.getMessage());
            } catch (Exception ignored) { }
        }
        return result.toString().getBytes(StandardCharsets.UTF_8);
    }

    private JSONObject choose() throws Exception {
        final CountDownLatch waiting;
        synchronized (pickerLock) {
            if (picker != null) throw new Failure("busy", "A folder picker is already open.");
            picker = waiting = new CountDownLatch(1); pickedTree = ""; pickerError = "";
        }
        activity.runOnUiThread(() -> {
            try {
                new AlertDialog.Builder(activity).setTitle("Open workspace")
                    .setItems(new String[]{"Link a device folder", "Open private notebook", "Export interrupted-save recovery copies…"}, (dialog, which) -> {
                        if (which == 1) { completePicker("private", ""); return; }
                        try {
                            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                            activity.startActivityForResult(intent, which == 2 ? EXPORT_RECOVERY : PICK_TREE);
                        } catch (Exception error) { completePicker("", "Android could not open the folder picker: " + error.getMessage()); }
                    }).setNegativeButton("Cancel", (dialog, which) -> completePicker("", ""))
                    .setOnCancelListener(dialog -> completePicker("", "")).show();
            } catch (Exception error) { completePicker("", "Android folder picker is unavailable."); }
        });
        try {
            if (!waiting.await(10, TimeUnit.MINUTES)) throw new Failure("cancelled", "Folder selection timed out. Try again.");
            synchronized (pickerLock) {
                if (!pickerError.isEmpty()) throw new Failure("permission", pickerError);
                return new JSONObject().put("tree", pickedTree);
            }
        } finally { synchronized (pickerLock) { if (picker == waiting) picker = null; } }
    }
    private void completePicker(String tree, String error) {
        synchronized (pickerLock) {
            if (picker == null) return;
            pickedTree = tree; pickerError = error; picker.countDown();
        }
    }
    public void cancelPicker() { completePicker("", "Folder selection was interrupted. Try again."); }
    public boolean result(int request, int result, Intent data) {
        if (request == EXPORT_RECOVERY) {
            if (result != Activity.RESULT_OK || data == null || data.getData() == null) { completePicker("", ""); return true; }
            final Uri target = data.getData();
            new Thread(() -> {
                try {
                    synchronized (ioLock) { exportRecovery(target); }
                    activity.runOnUiThread(() -> Toast.makeText(activity, "Recovery copies exported. Compare them with the original folder before resuming edits.", Toast.LENGTH_LONG).show());
                    completePicker("", "");
                } catch (Exception e) { completePicker("", "Could not export recovery copies: " + e.getMessage()); }
            }, "folder-recovery-export").start();
            return true;
        }
        if (request != PICK_TREE) return false;
        if (result != Activity.RESULT_OK || data == null || data.getData() == null) { completePicker("", ""); return true; }
        try {
            int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if ((flags & 3) != 3) throw new SecurityException("The selected folder must allow reading and writing.");
            resolver.takePersistableUriPermission(data.getData(), flags);
            completePicker(data.getData().toString(), "");
        } catch (Exception error) { completePicker("", "Persistent read/write access was not granted. Select a writable folder."); }
        return true;
    }

    private static void checkPath(String path) throws Failure {
        if (SETTINGS.equals(path)) return;
        if (path.isEmpty() || path.length() > 1024 || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) throw new Failure("path", "Invalid workspace path");
        for (String part : path.split("/", -1)) if (part.isEmpty() || part.startsWith(".")) throw new Failure("path", "Invalid workspace path");
    }
    private static final String[] COLUMNS = {Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_FLAGS};
    private Entry entry(Uri tree, Cursor c) throws Exception {
        String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
        if (id == null || name == null || mime == null || name.contains("/")) throw new Failure("io", "Provider returned an invalid document.");
        return new Entry(DocumentsContract.buildDocumentUriUsingTree(tree, id), name, mime, c.getLong(3));
    }
    private void complete(Cursor cursor) throws Exception {
        if (cursor == null) throw new Failure("io", "Folder provider returned no listing. Reconnect and retry.");
        Bundle extras = cursor.getExtras();
        if (extras != null && (extras.getBoolean(DocumentsContract.EXTRA_LOADING, false) || extras.containsKey(DocumentsContract.EXTRA_ERROR)))
            throw new Failure("io", "Folder provider is loading or unavailable. Sync is paused until a complete listing is available.");
    }
    private Entry root(Uri tree) throws Exception {
        if (!"content".equals(tree.getScheme()) || !DocumentsContract.isTreeUri(tree)) throw new Failure("path", "Select a folder using the Android folder picker.");
        Uri uri = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor c = resolver.query(uri, COLUMNS, null, null, null)) {
            complete(c);
            if (!c.moveToFirst()) throw new Failure("io", "Linked folder is unavailable. Use Open workspace to reconnect it.");
            Entry root = entry(tree, c);
            if (!root.directory()) throw new Failure("path", "The selected document is not a folder.");
            return root;
        }
    }
    private List<Entry> children(Uri tree, Entry parent) throws Exception {
        List<Entry> entries = new ArrayList<>(); HashSet<String> names = new HashSet<>();
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent.uri));
        try (Cursor c = resolver.query(children, COLUMNS, null, null, null)) {
            complete(c);
            while (c.moveToNext()) {
                Entry e = entry(tree, c);
                if (!names.add(e.name)) throw new Failure("io", "Folder contains ambiguous duplicate names: " + e.name);
                entries.add(e);
                if (entries.size() > MAX_ENTRIES) throw new Failure("size", "Folder contains too many entries.");
            }
            complete(c);
        }
        return entries;
    }
    private Entry resolve(Uri tree, Entry root, String path) throws Exception {
        if (path.isEmpty()) return root;
        checkPath(path);
        Entry at = root;
        for (String part : path.split("/")) {
            if (!at.directory()) throw new Failure("path", "A parent is not a folder: " + path);
            Entry found = null;
            for (Entry e : children(tree, at)) if (e.name.equals(part)) { found = e; break; }
            if (found == null) throw new Failure("missing", "File no longer exists: " + path);
            at = found;
        }
        return at;
    }
    private Entry optional(Uri tree, Entry root, String path) throws Exception {
        try { return resolve(tree, root, path); }
        catch (Failure e) { if (e.code.equals("missing")) return null; throw e; }
    }
    private void walk(Uri tree, Entry parent, String prefix, JSONArray files, HashSet<String> visited, int depth) throws Exception {
        if (depth > 32 || !visited.add(parent.uri.toString())) throw new Failure("size", "Folder nesting is too deep or cyclic.");
        for (Entry e : children(tree, parent)) {
            String path = prefix + e.name;
            if (e.name.startsWith(".") && !path.equals(SETTINGS)) continue;
            if (!e.directory() && !e.name.toLowerCase(Locale.ROOT).endsWith(".org")) continue;
            checkPath(path);
            files.put(new JSONObject().put("path", path).put("directory", e.directory()));
            if (files.length() > MAX_ENTRIES) throw new Failure("size", "Workspace has too many entries.");
            if (e.directory()) walk(tree, e, path + "/", files, visited, depth + 1);
        }
    }
    private byte[] read(Entry e) throws Exception {
        if (e.directory()) throw new Failure("path", "Cannot read a folder as a note.");
        if ((e.flags & Document.FLAG_VIRTUAL_DOCUMENT) != 0) throw new Failure("unsupported", "Virtual documents are not supported.");
        try (InputStream in = resolver.openInputStream(e.uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new Failure("io", "Provider could not open " + e.name);
            byte[] buffer = new byte[16384]; int n;
            while ((n = in.read(buffer)) != -1) { if (out.size() + n > MAX_BYTES) throw new Failure("size", "File exceeds 8 MiB"); out.write(buffer, 0, n); }
            return out.toByteArray();
        }
    }
    private static String hash(byte[] bytes) throws Exception {
        StringBuilder s = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) s.append(String.format(Locale.ROOT, "%02x", b & 255));
        return s.toString();
    }
    private static String parent(String path) { int slash = path.lastIndexOf('/'); return slash < 0 ? "" : path.substring(0, slash); }
    private static String name(String path) { return path.substring(path.lastIndexOf('/') + 1); }
    private void expect(Entry e, String revision) throws Exception {
        if (e == null ? !revision.isEmpty() : !hash(read(e)).equals(revision)) throw new Failure("conflict", "File changed outside OrbitalNote; your edits have been retained.");
    }
    private void durable(File file, byte[] data) throws Exception {
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(data); out.getFD().sync(); }
    }
    private void syncDirectory(File dir) throws Exception {
        java.io.FileDescriptor fd = android.system.Os.open(dir.getAbsolutePath(), android.system.OsConstants.O_RDONLY, 0);
        try { android.system.Os.fsync(fd); } finally { android.system.Os.close(fd); }
    }
    // SAF has no general atomic replace or compare-and-swap. Keep both revisions
    // durably in app-private storage BEFORE touching an existing provider file.
    // Failed/interrupted writes retain this bundle; successful verified saves
    // remove it. Never infer ENOENT from an I/O/permission exception.
    private File recovery(String tree, String path, byte[] old, byte[] intended, String operation) throws Exception {
        File dir = new File(activity.getFilesDir(), "folder-recovery/" + UUID.randomUUID());
        if (!dir.mkdirs()) throw new Failure("io", "Could not create recovery storage; original file was not changed.");
        if (old != null) durable(new File(dir, "original.org"), old);
        if (intended != null) durable(new File(dir, "pending.org"), intended);
        durable(new File(dir, "operation.json"), new JSONObject().put("tree", tree).put("path", path).put("operation", operation).put("created", System.currentTimeMillis()).toString().getBytes(StandardCharsets.UTF_8));
        syncDirectory(dir); syncDirectory(dir.getParentFile());
        return dir;
    }
    private List<File> recoveryBundles() {
        List<File> out = new ArrayList<>();
        File[] dirs = new File(activity.getFilesDir(), "folder-recovery").listFiles();
        if (dirs != null) for (File dir : dirs) if (new File(dir, "operation.json").isFile()) out.add(dir);
        return out;
    }
    private byte[] localBytes(File file) throws Exception {
        try (InputStream in = new java.io.FileInputStream(file); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[16384]; int n;
            while ((n = in.read(b)) != -1) { if (out.size() + n > MAX_BYTES) throw new Failure("size", "Recovery file exceeds size limit."); out.write(b, 0, n); }
            return out.toByteArray();
        }
    }
    private void checkRecoveries(Uri tree, Entry root) throws Exception {
        for (File dir : recoveryBundles()) {
            JSONObject journal = new JSONObject(new String(localBytes(new File(dir, "operation.json")), StandardCharsets.UTF_8));
            if (!tree.toString().equals(journal.getString("tree"))) continue;
            Entry current = optional(tree, root, journal.getString("path"));
            if (current == null && journal.getString("operation").equals("delete")) continue;
            if (current != null) {
                String revision = hash(read(current));
                File old = new File(dir, "original.org"), pending = new File(dir, "pending.org");
                if (old.isFile() && revision.equals(hash(localBytes(old))) || pending.isFile() && revision.equals(hash(localBytes(pending)))) continue;
            }
            throw new Failure("recovery", "An interrupted save needs recovery: " + journal.getString("path")
                + ". Sync is paused. Use Open workspace → Export interrupted-save recovery copies, then restore the chosen version in the original folder.");
        }
    }
    private void exportRecovery(Uri tree) throws Exception {
        Entry target = root(tree);
        List<File> bundles = recoveryBundles();
        if (bundles.isEmpty()) throw new Failure("missing", "There are no interrupted-save recovery copies.");
        for (File bundle : bundles) {
            Entry dir = create(tree, target, "OrbitalNote recovery " + bundle.getName(), true);
            for (String filename : new String[]{"original.org", "pending.org", "operation.json"}) {
                File file = new File(bundle, filename);
                if (file.isFile()) write(create(tree, dir, filename, false), localBytes(file));
            }
        }
    }
    private void archiveOlderRecoveries(String tree, String path, File current) throws Exception {
        for (File dir : recoveryBundles()) {
            if (dir.equals(current)) continue;
            JSONObject journal = new JSONObject(new String(localBytes(new File(dir, "operation.json")), StandardCharsets.UTF_8));
            if (!tree.equals(journal.getString("tree")) || !path.equals(journal.getString("path"))) continue;
            File archive = new File(activity.getFilesDir(), "folder-recovery-archive");
            if (!archive.isDirectory() && !archive.mkdirs() || !dir.renameTo(new File(archive, dir.getName())))
                throw new Failure("recovery", "The note was saved, but an older recovery bundle could not be archived.");
        }
    }
    private void clearRecovery(File dir) { File[] files = dir.listFiles(); if (files != null) for (File f : files) f.delete(); dir.delete(); }
    private void write(Entry entry, byte[] data) throws Exception {
        entry.require(Document.FLAG_SUPPORTS_WRITE, "writing");
        try (ParcelFileDescriptor fd = resolver.openFileDescriptor(entry.uri, "rwt")) {
            if (fd == null) throw new Failure("io", "Provider could not open the note for saving.");
            try (FileOutputStream out = new FileOutputStream(fd.getFileDescriptor())) { out.write(data); out.flush(); out.getFD().sync(); }
        }
        if (!hash(read(entry)).equals(hash(data))) throw new Failure("io", "Provider did not retain the complete saved note.");
    }
    private Entry create(Uri tree, Entry dir, String name, boolean folder) throws Exception {
        dir.require(Document.FLAG_DIR_SUPPORTS_CREATE, "creating files");
        // text/plain makes ExternalStorageProvider append .txt to unknown .org
        // suffixes. Generic binary MIME preserves the caller's exact filename.
        Uri uri = DocumentsContract.createDocument(resolver, dir.uri, folder ? Document.MIME_TYPE_DIR : "application/octet-stream", name);
        if (uri == null) throw new Failure("io", "Provider could not create the document.");
        try (Cursor c = resolver.query(uri, COLUMNS, null, null, null)) {
            complete(c); if (!c.moveToFirst()) throw new Failure("io", "Created file could not be verified.");
            Entry e = entry(tree, c);
            if (!e.name.equals(name)) throw new Failure("conflict", "Provider changed the requested filename; inspect the folder before retrying.");
            return e;
        }
    }
    private JSONObject perform(JSONObject q) throws Exception {
        Uri tree = Uri.parse(q.getString("tree")); Entry root = root(tree);
        String op = q.getString("op"), path = q.optString("path"), revision = q.optString("revision");
        JSONObject out = new JSONObject();
        if (op.equals("info")) { root.require(Document.FLAG_DIR_SUPPORTS_CREATE, "workspace writes"); return out.put("name", root.name); }
        if (op.equals("list")) { checkRecoveries(tree, root); JSONArray files = new JSONArray(); walk(tree, root, "", files, new HashSet<>(), 0); return out.put("files", files); }
        checkPath(path);
        if (op.equals("read")) return out.put("data", Base64.encodeToString(read(resolve(tree, root, path)), Base64.NO_WRAP));
        if (op.equals("write")) {
            if (!path.toLowerCase(Locale.ROOT).endsWith(".org")) throw new Failure("path", "Notes must use .org extension.");
            byte[] data = Base64.decode(q.optString("data"), Base64.DEFAULT);
            if (data.length > MAX_BYTES) throw new Failure("size", "File exceeds 8 MiB");
            Entry file = optional(tree, root, path); expect(file, revision);
            File backup = recovery(tree.toString(), path, file == null ? null : read(file), data, "write");
            try {
                // Re-resolve after journaling, covering external rename/replacement.
                file = optional(tree, root, path); expect(file, revision);
                if (file == null) file = create(tree, resolve(tree, root, parent(path)), name(path), false);
                write(file, data);
                Entry current = resolve(tree, root, path);
                if (!current.uri.equals(file.uri) || !hash(read(current)).equals(hash(data))) throw new Failure("conflict", "File changed while saving.");
                archiveOlderRecoveries(tree.toString(), path, backup);
                clearRecovery(backup); return out.put("revision", hash(data));
            } catch (Exception e) { throw new Failure(e instanceof Failure ? ((Failure)e).code : "io", e.getMessage() + " Recovery copies are retained in the private notebook recovery area (" + backup.getName() + ")."); }
        }
        if (op.equals("mkdir")) {
            if (optional(tree, root, path) != null) throw new Failure("exists", "Destination already exists.");
            create(tree, resolve(tree, root, parent(path)), name(path), true); return out;
        }
        Entry file = resolve(tree, root, path);
        if (op.equals("remove")) {
            file.require(Document.FLAG_SUPPORTS_DELETE, "deleting");
            File backup = null;
            if (file.directory()) { if (!revision.isEmpty() || !children(tree, file).isEmpty()) throw new Failure("conflict", "Only empty folders can be deleted."); }
            else { expect(file, revision); backup = recovery(tree.toString(), path, read(file), null, "delete"); expect(resolve(tree, root, path), revision); }
            if (!DocumentsContract.deleteDocument(resolver, file.uri)) throw new Failure("io", "Provider could not delete the document.");
            if (optional(tree, root, path) != null) throw new Failure("io", "Deletion could not be verified.");
            archiveOlderRecoveries(tree.toString(), path, backup);
            if (backup != null) clearRecovery(backup); return out;
        }
        if (op.equals("rename")) {
            String to = q.getString("to"); checkPath(to);
            if (to.startsWith(path + "/")) throw new Failure("path", "A folder cannot be moved inside itself.");
            if (optional(tree, root, to) != null) throw new Failure("exists", "Destination already exists.");
            file.require(Document.FLAG_SUPPORTS_RENAME, "renaming");
            Uri moved = file.uri;
            if (!parent(path).equals(parent(to))) {
                file.require(Document.FLAG_SUPPORTS_MOVE, "moving between folders");
                // A combined move+rename is not transactional across providers.
                if (!name(path).equals(name(to))) throw new Failure("unsupported", "Move and rename separately with this folder provider.");
                moved = DocumentsContract.moveDocument(resolver, file.uri, resolve(tree, root, parent(path)).uri, resolve(tree, root, parent(to)).uri);
            } else moved = DocumentsContract.renameDocument(resolver, file.uri, name(to));
            if (moved == null || optional(tree, root, to) == null) throw new Failure("io", "Provider could not verify the moved document. Refresh the folder before retrying.");
            return out;
        }
        throw new Failure("unsupported", "Unknown folder operation.");
    }
}
