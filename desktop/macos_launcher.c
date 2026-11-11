/* SPDX-License-Identifier: AGPL-3.0-only */
/* A native Launch Services entry point; all file processing remains in the app. */
#include <mach-o/dyld.h>
#include <libgen.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char **argv) {
    char executable[PATH_MAX], resolved[PATH_MAX], python[PATH_MAX], script[PATH_MAX];
    uint32_t length = sizeof(executable);
    if (_NSGetExecutablePath(executable, &length) || !realpath(executable, resolved)) return 1;
    char *directory = dirname(resolved);
    if (snprintf(python, sizeof(python), "%s/../Resources/ace-studio/runtime/python/bin/python3", directory) >= sizeof(python)) return 1;
    if (snprintf(script, sizeof(script), "%s/../Resources/ace-studio/launcher.py", directory) >= sizeof(script)) return 1;
    char **arguments = calloc((size_t)argc + 2, sizeof(char *));
    if (!arguments) return 1;
    arguments[0] = python;
    arguments[1] = script;
    for (int i = 1; i < argc; ++i) arguments[i + 1] = argv[i];
    execv(python, arguments);
    perror("ACE Studio runtime");
    free(arguments);
    return 1;
}
