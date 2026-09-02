plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sukobin.core"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    api("androidx.core:core-ktx:1.13.1")
    api("androidx.appcompat:appcompat:1.7.0")
    api("com.google.android.material:material:1.12.0")
    api("androidx.constraintlayout:constraintlayout:2.1.4")
    api("androidx.recyclerview:recyclerview:1.3.2")
    api("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    api("androidx.fragment:fragment-ktx:1.8.2")
    api("androidx.activity:activity-ktx:1.9.1")
    api("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.4")
    api("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    api("androidx.navigation:navigation-fragment-ktx:2.7.7")
    api("androidx.navigation:navigation-ui-ktx:2.7.7")

    api("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    api("com.squareup.retrofit2:retrofit:2.11.0")
    api("com.squareup.retrofit2:converter-gson:2.11.0")
    api("com.squareup.okhttp3:okhttp:4.12.0")
    api("com.squareup.okhttp3:logging-interceptor:4.12.0")

    api("io.coil-kt:coil:2.7.0")

    api(platform("com.google.firebase:firebase-bom:33.1.2"))
    api("com.google.firebase:firebase-messaging-ktx")
    api("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")
}
