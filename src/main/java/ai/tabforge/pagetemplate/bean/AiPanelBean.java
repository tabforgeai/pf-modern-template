package ai.tabforge.pagetemplate.bean;

import jakarta.enterprise.context.SessionScoped;
import jakarta.inject.Named;
import java.io.Serializable;

@Named("aiPanelBean")
@SessionScoped
public class AiPanelBean implements Serializable {

    private String status = "idle"; // idle, thinking, error

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isIdle()     { return "idle".equals(status); }
    public boolean isThinking() { return "thinking".equals(status); }
    public boolean isError()    { return "error".equals(status); }
}
