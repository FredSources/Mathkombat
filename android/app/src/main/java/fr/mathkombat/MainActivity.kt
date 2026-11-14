/**
 * MainActivity — wrapper WebView plein écran de MathKombat (J7).
 *
 * Charge le jeu web embarqué (`file:///android_asset/index.html`, copié depuis
 * `game/dist/` par `scripts/build-apk.sh`). Zéro permission, zéro réseau :
 * le jeu est jouable **hors-ligne**. Paysage forcé par le manifest.
 */
package fr.mathkombat

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        masquerBarresSysteme()

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true // localStorage : record / HIGH SCORE
        web.settings.mediaPlaybackRequiresUserGesture = false // sons du combat
        web.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        web.settings.allowFileAccess = true
        // tout reste dans la WebView (assets locaux, aucune navigation externe)
        web.webViewClient = WebViewClient()

        web.loadUrl("file:///android_asset/index.html")
    }

    /** Plein écran immersif : barres système masquées, re-masquées après contact. */
    private fun masquerBarresSysteme() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) masquerBarresSysteme()
    }
}
