{
  "targets": [
    {
      "target_name": "face_detector",
      "sources": [
        "src/native/face_detector.cpp",
        "src/native/face_detector_wrapper.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "C:\\opencv\\build\\include"
      ],
      "library_dirs": [
        "C:\\opencv\\build\\x64\\vc16\\lib"
      ],
      "libraries": [
        "opencv_world4120.lib"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "copies": [
        {
          "destination": "<(PRODUCT_DIR)",
          "files": [
            "C:\\opencv\\build\\x64\\vc16\\bin\\opencv_world4120.dll"
          ]
        }
      ]
    }
  ]
}