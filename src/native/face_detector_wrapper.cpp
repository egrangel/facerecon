#include <napi.h>
#include "face_detector.h"
#include <memory>

class FaceDetectorWrapper : public Napi::ObjectWrap<FaceDetectorWrapper> {
private:
    std::unique_ptr<FaceDetector> detector;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "FaceDetector", {
            InstanceMethod("initialize", &FaceDetectorWrapper::Initialize),
            InstanceMethod("initializeAsync", &FaceDetectorWrapper::Initialize), // Same method handles both
            InstanceMethod("detectFaces", &FaceDetectorWrapper::DetectFaces),
            InstanceMethod("detectFacesAsync", &FaceDetectorWrapper::DetectFacesAsync),
            InstanceMethod("setConfidenceThreshold", &FaceDetectorWrapper::SetConfidenceThreshold),
            InstanceMethod("isInitialized", &FaceDetectorWrapper::IsInitialized)
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("FaceDetector", func);
        return exports;
    }

    FaceDetectorWrapper(const Napi::CallbackInfo& info) : Napi::ObjectWrap<FaceDetectorWrapper>(info) {
        detector = std::make_unique<FaceDetector>();
    }

private:
    class InitializeAsyncWorker : public Napi::AsyncWorker {
    private:
        FaceDetector* detector;
        std::string modelPath;
        bool useDeepLearning;
        bool success;

    public:
        InitializeAsyncWorker(Napi::Function& callback, FaceDetector* det, const std::string& path, bool useDL)
            : Napi::AsyncWorker(callback), detector(det), modelPath(path), useDeepLearning(useDL), success(false) {}

        void Execute() override {
            success = detector->initialize(modelPath, useDeepLearning);
        }

        void OnOK() override {
            Napi::Env env = Env();
            Callback().Call({env.Null(), Napi::Boolean::New(env, success)});
        }
    };

    Napi::Value Initialize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        std::string modelPath = "";
        bool useDeepLearning = true;

        if (info.Length() > 0 && info[0].IsString()) {
            modelPath = info[0].As<Napi::String>().Utf8Value();
        }

        if (info.Length() > 1 && info[1].IsBoolean()) {
            useDeepLearning = info[1].As<Napi::Boolean>().Value();
        }

        if (info.Length() > 2 && info[2].IsFunction()) {
            // Async version with callback
            Napi::Function callback = info[2].As<Napi::Function>();
            InitializeAsyncWorker* worker = new InitializeAsyncWorker(
                callback, detector.get(), modelPath, useDeepLearning
            );
            worker->Queue();
            return env.Undefined();
        } else {
            // Sync version (may block - use with caution)
            bool success = detector->initialize(modelPath, useDeepLearning);
            return Napi::Boolean::New(env, success);
        }
    }

    Napi::Value DetectFaces(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsBuffer()) {
            Napi::TypeError::New(env, "Expected a Buffer as argument").ThrowAsJavaScriptException();
            return env.Null();
        }

        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        DetectionResult result = detector->detectFacesFromBuffer(buffer.Data(), buffer.Length());

        Napi::Object jsResult = Napi::Object::New(env);
        jsResult.Set("success", Napi::Boolean::New(env, result.success));
        jsResult.Set("processingTimeMs", Napi::Number::New(env, result.processingTimeMs));

        if (!result.success) {
            jsResult.Set("error", Napi::String::New(env, result.error));
            return jsResult;
        }

        Napi::Array faces = Napi::Array::New(env, result.faces.size());
        for (size_t i = 0; i < result.faces.size(); i++) {
            const DetectedFace& face = result.faces[i];

            Napi::Object jsFace = Napi::Object::New(env);

            Napi::Object boundingBox = Napi::Object::New(env);
            boundingBox.Set("x", Napi::Number::New(env, face.boundingBox.x));
            boundingBox.Set("y", Napi::Number::New(env, face.boundingBox.y));
            boundingBox.Set("width", Napi::Number::New(env, face.boundingBox.width));
            boundingBox.Set("height", Napi::Number::New(env, face.boundingBox.height));

            jsFace.Set("boundingBox", boundingBox);
            jsFace.Set("confidence", Napi::Number::New(env, face.confidence));

            faces.Set(i, jsFace);
        }

        jsResult.Set("faces", faces);
        return jsResult;
    }

    class DetectFacesAsyncWorker : public Napi::AsyncWorker {
    private:
        FaceDetector* detector;
        std::vector<uint8_t> imageData;
        DetectionResult result;

    public:
        DetectFacesAsyncWorker(Napi::Function& callback, FaceDetector* det, const uint8_t* data, size_t length)
            : Napi::AsyncWorker(callback), detector(det), imageData(data, data + length) {}

        void Execute() override {
            result = detector->detectFacesFromBuffer(imageData.data(), imageData.size());
        }

        void OnOK() override {
            Napi::Env env = Env();
            Napi::Object jsResult = Napi::Object::New(env);
            jsResult.Set("success", Napi::Boolean::New(env, result.success));
            jsResult.Set("processingTimeMs", Napi::Number::New(env, result.processingTimeMs));

            if (!result.success) {
                jsResult.Set("error", Napi::String::New(env, result.error));
                Callback().Call({env.Null(), jsResult});
                return;
            }

            Napi::Array faces = Napi::Array::New(env, result.faces.size());
            for (size_t i = 0; i < result.faces.size(); i++) {
                const DetectedFace& face = result.faces[i];

                Napi::Object jsFace = Napi::Object::New(env);

                Napi::Object boundingBox = Napi::Object::New(env);
                boundingBox.Set("x", Napi::Number::New(env, face.boundingBox.x));
                boundingBox.Set("y", Napi::Number::New(env, face.boundingBox.y));
                boundingBox.Set("width", Napi::Number::New(env, face.boundingBox.width));
                boundingBox.Set("height", Napi::Number::New(env, face.boundingBox.height));

                jsFace.Set("boundingBox", boundingBox);
                jsFace.Set("confidence", Napi::Number::New(env, face.confidence));

                faces.Set(i, jsFace);
            }

            jsResult.Set("faces", faces);
            Callback().Call({env.Null(), jsResult});
        }
    };

    Napi::Value DetectFacesAsync(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsFunction()) {
            Napi::TypeError::New(env, "Expected (Buffer, Function) as arguments").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
        Napi::Function callback = info[1].As<Napi::Function>();

        DetectFacesAsyncWorker* worker = new DetectFacesAsyncWorker(
            callback, detector.get(), buffer.Data(), buffer.Length()
        );
        worker->Queue();

        return env.Undefined();
    }

    Napi::Value SetConfidenceThreshold(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsNumber()) {
            Napi::TypeError::New(env, "Expected a number as argument").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        float threshold = info[0].As<Napi::Number>().FloatValue();
        detector->setConfidenceThreshold(threshold);

        return env.Undefined();
    }

    Napi::Value IsInitialized(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        return Napi::Boolean::New(env, detector->isInitialized());
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return FaceDetectorWrapper::Init(env, exports);
}

NODE_API_MODULE(face_detector, Init)