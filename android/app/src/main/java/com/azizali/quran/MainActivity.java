package com.azizali.quran;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeQuranAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
