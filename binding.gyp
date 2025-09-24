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
        "C:\\opencv\\build\\include",
        "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.0\\include"
      ],
      "library_dirs": [
        "C:\\opencv\\build\\x64\\vc16\\lib",
        "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.0\\lib\\x64"
      ],
      "libraries": [
        "opencv_world4120.lib",
        "cuda.lib",
        "cudart.lib",
        "cublas.lib",
        "curand.lib",
        "cufft.lib"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "HAVE_CUDA=1"
      ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/bigobj"]
            }
          },
          "libraries": [
            "cuda.lib",
            "cudart.lib",
            "cublas.lib"
          ]
        }]
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
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