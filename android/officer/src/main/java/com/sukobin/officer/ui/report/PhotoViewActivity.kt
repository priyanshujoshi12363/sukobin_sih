package com.sukobin.officer.ui.report

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import coil.load
import com.sukobin.officer.databinding.ActivityPhotoViewBinding

/**
 * Full screen view of a photo attached to a report. An officer deciding
 * whether to close a highway on somebody else's word needs to see the picture
 * properly, not a thumbnail.
 */
class PhotoViewActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_CAPTION = "caption"
    }

    private lateinit var b: ActivityPhotoViewBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPhotoViewBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnClose.setOnClickListener { finish() }

        val caption = intent.getStringExtra(EXTRA_CAPTION)
        b.caption.text = caption.orEmpty()
        b.caption.visibility = if (caption.isNullOrBlank()) View.GONE else View.VISIBLE

        intent.getStringExtra(EXTRA_URL)?.let { url ->
            b.photo.load(url) { crossfade(true) }
        }
    }
}
