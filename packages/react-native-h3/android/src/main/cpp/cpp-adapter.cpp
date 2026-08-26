//
//  cpp-adapter.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <jni.h>

#include <fbjni/fbjni.h>

#include "NitroH3OnLoad.hpp"

// `System.loadLibrary("NitroH3")` lands here; `registerAllNatives` fills Nitro's registry
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() { margelo::nitro::h3::registerAllNatives(); });
}
