package ai.tabforge.pagetemplate.bean;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.SessionScoped;
import jakarta.inject.Named;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Named("notifications")
@SessionScoped
public class NotificationsBean implements Serializable {

    private List<NotificationItem> items;

    @PostConstruct
    void init() {
        items = new ArrayList<>();
        items.add(new NotificationItem("New user registered",       "2 min ago",  "pi pi-user",     false));
        items.add(new NotificationItem("Monthly report generated",  "1h ago",     "pi pi-file-pdf", false));
        items.add(new NotificationItem("System update available",   "Yesterday",  "pi pi-sync",     true));
    }

    public List<NotificationItem> getItems() { return items; }

    public long getUnreadCount() {
        return items.stream().filter(n -> !n.isRead()).count();
    }
}
