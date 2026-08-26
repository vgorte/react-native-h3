require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
h3 = JSON.parse(File.read(File.join(__dir__, "third_party", "h3", "sources.json")))

Pod::Spec.new do |s|
  s.name         = "NitroH3"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/vgorte/react-native-h3"
  s.license      = { :type => package["license"], :file => "LICENSE" }
  s.authors      = package["author"] || "react-native-h3 contributors"
  s.platforms    = { :ios => min_ios_version_supported }  # <-- inherited, never pinned
  s.source       = { :git => "https://github.com/vgorte/react-native-h3.git", :tag => "#{s.version}" }

  # Our C++, which keeps the pod's default warnings
  s.source_files = [
    "cpp/**/*.{hpp,cpp}",
    "third_party/h3/include/*.h",
  ]

  # The gtest suites build under `cpp/test/CMakeLists.txt`, never inside the app
  s.exclude_files = "cpp/test/**/*"

  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/third_party/h3/include\" \"$(PODS_TARGET_SRCROOT)/cpp\"",
  }

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"

  # Vendored H3 (C), from the same list Android reads. A subspec so `-w` covers upstream's
  # sources and nothing of ours; CMake scopes the same flag with `set_source_files_properties`.
  s.subspec "h3" do |h3_spec|
    h3_spec.source_files = h3["sources"].map { |source| "third_party/h3/#{source}" }
    h3_spec.compiler_flags = "-w"
  end

  # Nitrogen autolinking, which must stay last: `add_nitrogen_files` reads `spec.attributes_hash`
  # and merges, so anything assigned after it clobbers Nitro's values, `c++20` included.
  load File.join(__dir__, "nitrogen/generated/ios/NitroH3+autolinking.rb")
  add_nitrogen_files(s)
end
