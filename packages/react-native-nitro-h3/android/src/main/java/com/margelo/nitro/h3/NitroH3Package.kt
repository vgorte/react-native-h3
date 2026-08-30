package com.margelo.nitro.h3

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Loads the `NitroH3` C++ library when React Native instantiates the autolinked packages.
 *
 * Exports no native module of its own: every function reaches JavaScript through the `H3`
 * HybridObject that `JNI_OnLoad` registers with Nitro. React Native's Android autolinking
 * also needs this class to exist before it will build the library at all.
 */
class NitroH3Package : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider { emptyMap<String, ReactModuleInfo>() }

  companion object {
    init {
      NitroH3OnLoad.initializeNative()
    }
  }
}
