package fr.gryphou.glfm

import java.net.URI

/**
 * The pieces of a URL that both the remote normaliser and the config-script
 * builder need.
 *
 * Exists because [java.net.URI.getHost] drops the port: rebuilding a URL from
 * the host alone silently rewrites `https://gitlab.example.com:8443/group/project`
 * into an address that does not answer, which every self-hosted instance served
 * off a non-default port is.
 */
internal class UrlParts private constructor(
    val scheme: String,
    val host: String,
    port: Int,
    val path: String,
) {

    /** `scheme://host[:port]` - the instance root every other URL hangs off. */
    val origin: String = if (port == -1) "$scheme://$host" else "$scheme://$host:$port"

    /**
     * The same origin, pointed at the web interface.
     *
     * A `git`/`ssh` remote names a transport port the web interface does not
     * listen on, so that form keeps only the host; an `http(s)` remote already
     * is a web address and keeps its scheme and port verbatim.
     */
    val webOrigin: String = if (scheme in WEB_SCHEMES) origin else "https://$host"

    val isWeb: Boolean = scheme in WEB_SCHEMES

    companion object {
        private val WEB_SCHEMES = setOf("http", "https")

        /**
         * Whether [url] is an absolute `http(s)` address.
         *
         * The only form the preview can hang a reference off: anything else
         * would be emitted as a relative href and resolve against the preview's
         * own static server.
         */
        fun isWebUrl(url: String): Boolean = parse(url)?.isWeb == true

        /** Null for anything without an absolute scheme and a host. */
        fun parse(url: String): UrlParts? {
            val uri = runCatching { URI(url.trim()) }.getOrNull() ?: return null
            val scheme = uri.scheme?.lowercase() ?: return null
            val host = uri.host ?: return null
            return UrlParts(scheme, host, uri.port, uri.path.orEmpty().trim('/'))
        }
    }
}
