package ai.tabforge.pagetemplate.bean;

public class NotificationItem {

    private String message;
    private String time;
    private String icon;
    private boolean read;

    public NotificationItem(String message, String time, String icon, boolean read) {
        this.message = message;
        this.time    = time;
        this.icon    = icon;
        this.read    = read;
    }

    public String  getMessage() { return message; }
    public String  getTime()    { return time; }
    public String  getIcon()    { return icon; }
    public boolean isRead()     { return read; }
    public void    setRead(boolean read) { this.read = read; }
}
