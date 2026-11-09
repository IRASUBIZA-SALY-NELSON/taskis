package rw.salynelson.taskis;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TaskisSharePlugin.class);
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) share(getIntent()); // launched from the share sheet
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        share(intent); // shared while Taskis was already open
    }

    private void share(Intent intent) {
        if (getBridge() == null || getBridge().getPlugin("TaskisShare") == null) return;
        ((TaskisSharePlugin) getBridge().getPlugin("TaskisShare").getInstance()).handleIntent(intent);
    }
}
