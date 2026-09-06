#define _GNU_SOURCE
#include <dirent.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static const char kFrom[] = "/usr/share/nsis";
static char g_to[4096];

static void load_to(void) {
  if (g_to[0]) {
    return;
  }
  const char *value = getenv("BP_NSIS_ROOT");
  if (value && value[0]) {
    snprintf(g_to, sizeof(g_to), "%s", value);
  }
}

static const char *rewrite(const char *path, char *buf, size_t buf_len) {
  load_to();
  if (!path || path[0] != '/' || !g_to[0]) {
    return path;
  }
  size_t from_len = sizeof(kFrom) - 1;
  if (strncmp(path, kFrom, from_len) != 0) {
    return path;
  }
  if (path[from_len] != '\0' && path[from_len] != '/') {
    return path;
  }
  snprintf(buf, buf_len, "%s%s", g_to, path + from_len);
  return buf;
}

int open(const char *path, int flags, ...) {
  static int (*real_open)(const char *, int, ...) = NULL;
  if (!real_open) {
    real_open = dlsym(RTLD_NEXT, "open");
  }
  char buf[4096];
  const char *mapped = rewrite(path, buf, sizeof(buf));
  if (flags & O_CREAT) {
    va_list args;
    va_start(args, flags);
    mode_t mode = (mode_t)va_arg(args, int);
    va_end(args);
    return real_open(mapped, flags, mode);
  }
  return real_open(mapped, flags);
}

int open64(const char *path, int flags, ...) {
  static int (*real_open64)(const char *, int, ...) = NULL;
  if (!real_open64) {
    real_open64 = dlsym(RTLD_NEXT, "open64");
  }
  char buf[4096];
  const char *mapped = rewrite(path, buf, sizeof(buf));
  if (flags & O_CREAT) {
    va_list args;
    va_start(args, flags);
    mode_t mode = (mode_t)va_arg(args, int);
    va_end(args);
    return real_open64(mapped, flags, mode);
  }
  return real_open64(mapped, flags);
}

int openat(int dirfd, const char *path, int flags, ...) {
  static int (*real_openat)(int, const char *, int, ...) = NULL;
  if (!real_openat) {
    real_openat = dlsym(RTLD_NEXT, "openat");
  }
  char buf[4096];
  const char *mapped = rewrite(path, buf, sizeof(buf));
  if (flags & O_CREAT) {
    va_list args;
    va_start(args, flags);
    mode_t mode = (mode_t)va_arg(args, int);
    va_end(args);
    return real_openat(dirfd, mapped, flags, mode);
  }
  return real_openat(dirfd, mapped, flags);
}

int openat64(int dirfd, const char *path, int flags, ...) {
  static int (*real_openat64)(int, const char *, int, ...) = NULL;
  if (!real_openat64) {
    real_openat64 = dlsym(RTLD_NEXT, "openat64");
  }
  char buf[4096];
  const char *mapped = rewrite(path, buf, sizeof(buf));
  if (flags & O_CREAT) {
    va_list args;
    va_start(args, flags);
    mode_t mode = (mode_t)va_arg(args, int);
    va_end(args);
    return real_openat64(dirfd, mapped, flags, mode);
  }
  return real_openat64(dirfd, mapped, flags);
}

FILE *fopen(const char *path, const char *mode) {
  static FILE *(*real_fopen)(const char *, const char *) = NULL;
  if (!real_fopen) {
    real_fopen = dlsym(RTLD_NEXT, "fopen");
  }
  char buf[4096];
  return real_fopen(rewrite(path, buf, sizeof(buf)), mode);
}

FILE *fopen64(const char *path, const char *mode) {
  static FILE *(*real_fopen64)(const char *, const char *) = NULL;
  if (!real_fopen64) {
    real_fopen64 = dlsym(RTLD_NEXT, "fopen64");
  }
  char buf[4096];
  return real_fopen64(rewrite(path, buf, sizeof(buf)), mode);
}

int access(const char *path, int mode) {
  static int (*real_access)(const char *, int) = NULL;
  if (!real_access) {
    real_access = dlsym(RTLD_NEXT, "access");
  }
  char buf[4096];
  return real_access(rewrite(path, buf, sizeof(buf)), mode);
}

int faccessat(int dirfd, const char *path, int mode, int flags) {
  static int (*real_faccessat)(int, const char *, int, int) = NULL;
  if (!real_faccessat) {
    real_faccessat = dlsym(RTLD_NEXT, "faccessat");
  }
  char buf[4096];
  return real_faccessat(dirfd, rewrite(path, buf, sizeof(buf)), mode, flags);
}

int stat(const char *path, struct stat *statbuf) {
  static int (*real_stat)(const char *, struct stat *) = NULL;
  if (!real_stat) {
    real_stat = dlsym(RTLD_NEXT, "stat");
  }
  char buf[4096];
  return real_stat(rewrite(path, buf, sizeof(buf)), statbuf);
}

int lstat(const char *path, struct stat *statbuf) {
  static int (*real_lstat)(const char *, struct stat *) = NULL;
  if (!real_lstat) {
    real_lstat = dlsym(RTLD_NEXT, "lstat");
  }
  char buf[4096];
  return real_lstat(rewrite(path, buf, sizeof(buf)), statbuf);
}

int __xstat(int ver, const char *path, struct stat *statbuf) {
  static int (*real_xstat)(int, const char *, struct stat *) = NULL;
  if (!real_xstat) {
    real_xstat = dlsym(RTLD_NEXT, "__xstat");
  }
  char buf[4096];
  return real_xstat(ver, rewrite(path, buf, sizeof(buf)), statbuf);
}

int __lxstat(int ver, const char *path, struct stat *statbuf) {
  static int (*real_lxstat)(int, const char *, struct stat *) = NULL;
  if (!real_lxstat) {
    real_lxstat = dlsym(RTLD_NEXT, "__lxstat");
  }
  char buf[4096];
  return real_lxstat(ver, rewrite(path, buf, sizeof(buf)), statbuf);
}

int __xstat64(int ver, const char *path, struct stat *statbuf) {
  static int (*real_xstat64)(int, const char *, struct stat *) = NULL;
  if (!real_xstat64) {
    real_xstat64 = dlsym(RTLD_NEXT, "__xstat64");
  }
  char buf[4096];
  return real_xstat64(ver, rewrite(path, buf, sizeof(buf)), statbuf);
}

int chdir(const char *path) {
  static int (*real_chdir)(const char *) = NULL;
  if (!real_chdir) {
    real_chdir = dlsym(RTLD_NEXT, "chdir");
  }
  char buf[4096];
  return real_chdir(rewrite(path, buf, sizeof(buf)));
}

DIR *opendir(const char *path) {
  static DIR *(*real_opendir)(const char *) = NULL;
  if (!real_opendir) {
    real_opendir = dlsym(RTLD_NEXT, "opendir");
  }
  char buf[4096];
  return real_opendir(rewrite(path, buf, sizeof(buf)));
}

int newfstatat(int dirfd, const char *path, struct stat *statbuf, int flags) {
  static int (*real_newfstatat)(int, const char *, struct stat *, int) = NULL;
  if (!real_newfstatat) {
    real_newfstatat = dlsym(RTLD_NEXT, "newfstatat");
  }
  char buf[4096];
  return real_newfstatat(dirfd, rewrite(path, buf, sizeof(buf)), statbuf, flags);
}
