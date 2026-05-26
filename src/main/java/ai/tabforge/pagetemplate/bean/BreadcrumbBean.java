package ai.tabforge.pagetemplate.bean;

import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.faces.context.ExternalContext;
import org.primefaces.model.menu.DefaultMenuItem;
import org.primefaces.model.menu.DefaultMenuModel;
import org.primefaces.model.menu.MenuModel;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Named("breadcrumb")
@RequestScoped
public class BreadcrumbBean implements Serializable {

    @Inject
    private ExternalContext externalContext;

    private final List<DefaultMenuItem> items = new ArrayList<>();

    // Called by page backing beans to append items to the trail.
    // "Home" is always prepended automatically in getModel().
    public void addItem(String label, String url) {
        items.add(DefaultMenuItem.builder()
                .value(label)
                .url(externalContext.getRequestContextPath() + url)
                .build());
    }

    public void addItem(String label) {
        items.add(DefaultMenuItem.builder()
                .value(label)
                .disabled(true)
                .build());
    }

    public MenuModel getModel() {
        DefaultMenuModel model = new DefaultMenuModel();

        model.getElements().add(
                DefaultMenuItem.builder()
                        .value("Home")
                        .icon("pi pi-home")
                        .url(externalContext.getRequestContextPath() + "/index.xhtml")
                        .build()
        );

        items.forEach(item -> model.getElements().add(item));

        return model;
    }
}
