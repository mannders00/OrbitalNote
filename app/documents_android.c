//go:build android

#include "documents_android.h"
#include <stdlib.h>
#include <string.h>
#include <pthread.h>

static JavaVM *vm;
static jobject bridge;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
void orbitalDocumentsInstall(JNIEnv *env, jobject documents) {
    pthread_mutex_lock(&lock);
    (*env)->GetJavaVM(env, &vm);
    if (bridge) (*env)->DeleteGlobalRef(env, bridge);
    bridge = (*env)->NewGlobalRef(env, documents);
    pthread_mutex_unlock(&lock);
}
void *orbitalDocumentsCall(const void *input, int length, int *outputLength) {
    *outputLength = 0;
    pthread_mutex_lock(&lock);
    JavaVM *jvm = vm;
    pthread_mutex_unlock(&lock);
    if (!jvm) return NULL;
    JNIEnv *env = NULL;
    int detach = 0;
    jint result = (*jvm)->GetEnv(jvm, (void **)&env, JNI_VERSION_1_6);
    if (result == JNI_EDETACHED) {
        if ((*jvm)->AttachCurrentThread(jvm, &env, NULL) != JNI_OK) return NULL;
        detach = 1;
    } else if (result != JNI_OK) return NULL;
    pthread_mutex_lock(&lock);
    jobject target = (*env)->NewLocalRef(env, bridge);
    pthread_mutex_unlock(&lock);
    jclass cls = (*env)->GetObjectClass(env, target);
    jmethodID method = (*env)->GetMethodID(env, cls, "dispatch", "([B)[B");
    jbyteArray request = (*env)->NewByteArray(env, length);
    (*env)->SetByteArrayRegion(env, request, 0, length, input);
    jbyteArray reply = method ? (*env)->CallObjectMethod(env, target, method, request) : NULL;
    void *out = NULL;
    if ((*env)->ExceptionCheck(env)) { (*env)->ExceptionClear(env); }
    else if (reply) {
        jsize n = (*env)->GetArrayLength(env, reply);
        out = malloc(n);
        if (out) { (*env)->GetByteArrayRegion(env, reply, 0, n, out); *outputLength = n; }
    }
    if (reply) (*env)->DeleteLocalRef(env, reply);
    (*env)->DeleteLocalRef(env, request);
    (*env)->DeleteLocalRef(env, cls);
    (*env)->DeleteLocalRef(env, target);
    if (detach) (*jvm)->DetachCurrentThread(jvm);
    return out;
}
