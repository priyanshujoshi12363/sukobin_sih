plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The shared google-services.json does not list com.sukobin.officer yet, and
// the plugin hard-fails on a missing client rather than warning. Register the
// app in the Firebase console, drop its google-services.json in this folder,
// and push starts working with no other change. Until then the app builds and
// runs normally; Push.currentToken() returns null and registration is skipped.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "com.sukobin.officer"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sukobin.officer"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "2.0"
    }

    buildTypes {
        release { isMinifyEnabled = false }
    }

    buildFeatures { viewBinding = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core"))
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
