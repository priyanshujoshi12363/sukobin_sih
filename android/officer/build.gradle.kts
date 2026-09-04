plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// No Firebase and no push. Alerts reach an officer through the in-app inbox
// (Notifications screen) instead, so this app needs no google-services.json
// and no notification permission.

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
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
