package ai.tabforge.pagetemplate.bean;

import jakarta.enterprise.context.SessionScoped;
import jakarta.inject.Named;
import java.io.Serializable;

@Named("guestPreferences")
@SessionScoped
public class GuestPreferencesBean implements Serializable {

    private String theme      = "light";    // light | dark | dim
    private String menuLayout = "static";   // static | overlay | slim | horizontal
    private String menuTheme  = "dark";     // dark | light
    private String inputStyle = "outlined"; // outlined | filled
    private boolean menuActive    = false;
    private boolean aiPanelOpen   = false;
    private boolean rtl           = false;

    // Returns the CSS class to add to layout-wrapper for the current menu layout.
    // "static" is the default and needs no extra class.
    public String getMenuLayoutClass() {
        if ("static".equals(menuLayout)) return "";
        return "layout-menu-" + menuLayout;
    }

    public String getTheme()               { return theme; }
    public void   setTheme(String t)       { this.theme = t; }

    public String getMenuLayout()          { return menuLayout; }
    public void   setMenuLayout(String m)  { this.menuLayout = m; }

    public boolean isMenuActive()              { return menuActive; }
    public void    setMenuActive(boolean v)    { this.menuActive = v; }

    public boolean isAiPanelOpen()             { return aiPanelOpen; }
    public void    setAiPanelOpen(boolean v)   { this.aiPanelOpen = v; }

    public String getMenuTheme()              { return menuTheme; }
    public void   setMenuTheme(String v)      { this.menuTheme = v; }

    public String getInputStyle()             { return inputStyle; }
    public void   setInputStyle(String v)     { this.inputStyle = v; }

    public boolean isRtl()                    { return rtl; }
    public void    setRtl(boolean v)          { this.rtl = v; }
}
