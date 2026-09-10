import org.intellij.markdown.ast.ASTNode;
import org.intellij.markdown.flavours.MarkdownFlavourDescriptor;
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor;
import org.intellij.markdown.html.HtmlGenerator;
import org.intellij.markdown.parser.MarkdownParser;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;

/** Renders Markdown exactly as the IDE preview would, for inspection. */
public class Render {
    public static void main(String[] args) throws Exception {
        String src = Files.readString(Path.of(args[0]));
        MarkdownFlavourDescriptor flavour = flavour();
        ASTNode tree = new MarkdownParser(flavour).buildMarkdownTreeFromString(src);
        HtmlGenerator generator = new HtmlGenerator(src, tree, flavour, System.getenv("NO_SRC_POS") != null ? false : true);

        Method generate = HtmlGenerator.class.getDeclaredMethod("generateHtml$default",
                HtmlGenerator.class, HtmlGenerator.TagRenderer.class, int.class, Object.class);
        System.out.println((String) generate.invoke(null, generator, null, 1, null));
    }

    private static MarkdownFlavourDescriptor flavour() {
        try {
            if (System.getenv("USE_GFM") != null) throw new IllegalStateException("forced GFM");
            Class<?> c = Class.forName("org.intellij.plugins.markdown.lang.parser.MarkdownDefaultFlavour");
            return (MarkdownFlavourDescriptor) c.getDeclaredConstructor().newInstance();
        } catch (Throwable t) {
            System.err.println("[falling back to GFMFlavourDescriptor: " + t + "]");
            return new GFMFlavourDescriptor();
        }
    }
}
