package fr.gryphou.glfm

/** Turns the contents of a `.git/config` into a GitLab project web URL. */
object GitRemoteParser {

    /** Extracts the `url` of `[remote "origin"]`, falling back to the first remote. */
    fun originUrl(config: String): String? {
        var section: String? = null
        var firstRemoteUrl: String? = null

        for (rawLine in config.lineSequence()) {
            val line = rawLine.trim()
            if (line.startsWith("[")) {
                section = normaliseSection(line)
                continue
            }
            if (line.substringBefore('=', "").trim().lowercase() != URL_KEY) continue

            val url = valueOf(line.substringAfter('=', ""))
            if (url.isEmpty()) continue
            if (section == ORIGIN) return url
            if (section?.startsWith("remote ") == true && firstRemoteUrl == null) {
                firstRemoteUrl = url
            }
        }
        return firstRemoteUrl
    }

    /**
     * The usable part of a `key = value` right-hand side.
     *
     * Git allows a `#` or `;` comment after a value and allows the value itself
     * to be quoted; neither is stripped here by the caller, so a remote written
     * with either would otherwise carry the comment - or the quotes - into every
     * URL derived from it.
     */
    private fun valueOf(raw: String): String {
        var quoted = false
        var escaped = false

        raw.forEachIndexed { index, character ->
            when {
                escaped -> escaped = false
                character == '\\' -> escaped = true
                character == '"' -> quoted = !quoted
                !quoted && (character == '#' || character == ';') ->
                    return unquote(raw.substring(0, index))
            }
        }
        return unquote(raw)
    }

    private fun unquote(value: String): String = value.trim().removeSurrounding("\"")

    /**
     * Canonical form of a section header.
     *
     * Git treats a section name as case-insensitive and tolerates any spacing
     * around the subsection, but a subsection name is compared verbatim. The
     * header may also be followed by a comment, which is why the brackets are
     * cut at rather than stripped from the ends.
     */
    private fun normaliseSection(header: String): String {
        val inner = header.substringAfter('[').substringBeforeLast(']').trim()
        val name = inner.substringBefore('"').trim().lowercase()
        if (!inner.contains('"')) return name
        return "$name \"${inner.substringAfter('"').substringBeforeLast('"')}\""
    }

    /** Normalises any git remote form into an `https://host/group/project` URL. */
    fun toWebUrl(remote: String): String? {
        val trimmed = remote.trim().removeSuffix("/").removeSuffix(".git")
        if (trimmed.isEmpty()) return null

        val scpLike = SCP_LIKE.matchEntire(trimmed)
        if (scpLike != null) {
            val (host, path) = scpLike.destructured
            return "https://$host/${path.trimStart('/')}"
        }

        val parts = UrlParts.parse(trimmed) ?: return null
        if (parts.path.isEmpty()) return null
        return "${parts.webOrigin}/${parts.path}"
    }

    /**
     * Auto-detection only claims a remote that is recognisably GitLab.
     *
     * Only the host is inspected: a project merely *named* `gitlab-something`
     * on another forge is not a GitLab project, and linking its `#123` into
     * GitLab's `/-/issues/` layout would only produce 404s.
     */
    fun isGitLab(webUrl: String): Boolean =
        UrlParts.parse(webUrl)?.host?.contains("gitlab", ignoreCase = true) == true

    private const val ORIGIN = "remote \"origin\""
    private const val URL_KEY = "url"

    // git@host:group/project
    private val SCP_LIKE = Regex("""^[^/@]+@([^:/]+):(.+)$""")
}
