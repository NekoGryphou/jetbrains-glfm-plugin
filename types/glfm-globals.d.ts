/**
 * Globals the preview renderer relies on but does not declare itself.
 *
 * `__GLFM_CONFIG__` is generated per preview panel by GlfmPreviewExtension.kt,
 * and `IncrementalDOM` is provided by the platform's JCEF preview. This file is
 * for the IDE only - it is not packaged into the plugin.
 */

interface GlfmFeatures {
    references: boolean;
    details: boolean;
    tableOfContents: boolean;
    footnotes: boolean;
    multilineBlockquote: boolean;
    inlineDiff: boolean;
    colorChips: boolean;
    emoji: boolean;
    inapplicableTasks: boolean;
    media: boolean;
    /** The visible permalink on each heading, rendered by `transformHeadingAnchors`. */
    headingAnchors: boolean;

    /**
     * Heading `id` attributes, which the anchors and the table of contents both
     * link to. Derived from `headingAnchors` and `tableOfContents` by the plugin.
     */
    headingIds: boolean;

    [feature: string]: boolean | undefined;
}

interface GlfmConfig {
    projectUrl: string;
    instanceUrl: string;
    dark: boolean;
    features: GlfmFeatures;
}

interface IncrementalDomNotifications {
    afterPatchListeners?: Array<() => void>;
}

interface Window {
    __GLFM_CONFIG__?: GlfmConfig;
    __GLFM_EMOJI__?: Record<string, string>;
    GLFM: Record<string, any>;
    IncrementalDOM?: { notifications?: IncrementalDomNotifications };
}
