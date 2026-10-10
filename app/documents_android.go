package main

/*
#include <stdlib.h>
#include "documents_android.h"
*/
import "C"

import (
	"errors"
	"unsafe"
)

//export Java_com_wails_app_WorkspaceDocuments_nativeInstall
func Java_com_wails_app_WorkspaceDocuments_nativeInstall(env *C.JNIEnv, object C.jobject) {
	C.orbitalDocumentsInstall(env, object)
}

func androidDocuments(input []byte) ([]byte, error) {
	var size C.int
	data := C.CBytes(input)
	defer C.free(data)
	result := C.orbitalDocumentsCall(data, C.int(len(input)), &size)
	if result == nil {
		return nil, errors.New("Android folder service is unavailable; reopen OrbitalNote")
	}
	defer C.free(unsafe.Pointer(result))
	return C.GoBytes(result, size), nil
}
