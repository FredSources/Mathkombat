/**
 * MainActivity — wrapper WebView plein écran de MathKombat (J7).
 *
 * Charge le jeu web embarqué avec une **origine simulée**
 * (`https://appassets.androidplatform.net/assets/…`) : les **modules ES** de
 * Vite ne se chargent pas depuis `file://` (règles cross-origin Android) —
 * d'où un écran noir. Ici, chaque requête est interceptée et servie depuis
 * `android_asset/` : modules, styles, images, sons — **zéro réseau**.
 *
 * Plein écran immersif, paysage (manifest), aucune permission.
 */
package fr.mathkombat

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.Uri

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
        web.settings.blockNetworkLoads = true // hors-ligne garanti (certif. RELEASE)

        // origine simulée + interception : modules ES depuis les assets embarqués
        web.webViewClient = ClientAssets()

        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
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

    /** Sert `android_asset/` sous l'origine simulée (module ES compatible). */
    private inner class ClientAssets : WebViewClient() {
        override fun shouldInterceptRequest(
            view: WebView?,
            request: WebResourceRequest?
        ): WebResourceResponse? {
            val url: Uri = request?.url ?: return null
            if (url.host != "appassets.androidplatform.net") return null
            val relatif = (url.path ?: return null).removePrefix("/assets/")
            return try {
                val flux = assets.open(relatif)
                val reponse = WebResourceResponse(typeMime(relatif), "UTF-8", flux)
                reponse.setStatusCodeAndReasonPhrase(200, "OK")
                reponse.responseHeaders = mapOf("Access-Control-Allow-Origin" to "*")
                reponse
            } catch (e: Exception) {
                null // ressource absente : la WebView répond 404 elle-même
            }
        }
    }
}

/** Types MIME des ressources du jeu (extensions servies par `game/dist/`). */
private fun typeMime(chemin: String): String = when {
    chemin.endsWith(".html") -> "text/html"
    chemin.endsWith(".js") -> "text/javascript"
    chemin.endsWith(".css") -> "text/css"
    chemin.endsWith(".json") -> "application/json"
    chemin.endsWith(".png") -> "image/png"
    chemin.endsWith(".jpg") || chemin.endsWith(".jpeg") -> "image/jpeg"
    chemin.endsWith(".svg") -> "image/svg+xml"
    chemin.endsWith(".wav") -> "audio/wav"
    else -> "application/octet-stream"
}
