#include <jni.h>
#include <string>
#include <thread>
#include "stable-diffusion.h"

static std::string text(JNIEnv* env, jstring value) {
    const char* chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars ? chars : "");
    if (chars) env->ReleaseStringUTFChars(value, chars);
    return result;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_kingcon42o_avatarforge_AvatarForgeAIPlugin_generateNative(JNIEnv* env, jclass, jstring modelValue, jstring promptValue, jstring negativeValue, jint steps) {
    std::string model = text(env, modelValue), prompt = text(env, promptValue), negative = text(env, negativeValue);
    sd_ctx_params_t contextParams; sd_ctx_params_init(&contextParams);
    contextParams.model_path = model.c_str();
    contextParams.n_threads = std::max(2u, std::thread::hardware_concurrency() > 1 ? std::thread::hardware_concurrency() - 1 : 2u);
    contextParams.backend = "cpu"; contextParams.enable_mmap = true; contextParams.auto_fit = true;
    sd_ctx_t* context = new_sd_ctx(&contextParams); if (!context) return nullptr;
    sd_img_gen_params_t params; sd_img_gen_params_init(&params);
    params.prompt = prompt.c_str(); params.negative_prompt = negative.c_str(); params.width = 512; params.height = 512;
    params.sample_params.sample_steps = steps; params.sample_params.guidance.txt_cfg = 7.0f;
    params.sample_params.sample_method = sd_get_default_sample_method(context);
    params.sample_params.scheduler = sd_get_default_scheduler(context, params.sample_params.sample_method);
    params.seed = -1; params.batch_count = 1;
    sd_image_t* images = nullptr; int count = 0; bool ok = generate_image(context, &params, &images, &count);
    if (!ok || !images || count < 1 || !images[0].data) { free_sd_ctx(context); return nullptr; }
    size_t size = static_cast<size_t>(images[0].width) * images[0].height * images[0].channel;
    jbyteArray result = env->NewByteArray(static_cast<jsize>(size));
    env->SetByteArrayRegion(result, 0, static_cast<jsize>(size), reinterpret_cast<jbyte*>(images[0].data));
    free_sd_images(images, count); free_sd_ctx(context); return result;
}
