package com.hewers.workforce;
import android.content.*;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineAttendanceTest {
 @Test public void manualLogSurvivesWithoutSignalAndEncryptsQueue() throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).edit().clear().commit();
  UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  device.executeShellCommand("svc wifi disable");device.executeShellCommand("svc data disable");
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{try{
    LinearLayout panel=new LinearLayout(activity);panel.setOrientation(LinearLayout.VERTICAL);ScrollView container=new ScrollView(activity);container.addView(panel);((ViewGroup)activity.findViewById(android.R.id.content)).addView(container,new ViewGroup.LayoutParams(-1,-1));
    OfflineAttendance offline=new OfflineAttendance(activity);offline.attach(panel);offline.setContainer(container);
    JSONObject schedule=new JSONObject().put("start","06:00").put("end","15:00").put("breakStart","12:00").put("breakEnd","13:00");
    JSONObject worker=new JSONObject().put("id","sample-worker").put("name","Offline Sample Worker").put("siteId","sample-site").put("site","Sample site").put("open",false).put("schedule",schedule);
    offline.cache(new JSONObject().put("owner","sample-owner").put("userId","sample-user").put("actor","Sample operator").put("role","auditor").put("workers",new JSONArray().put(worker)));offline.open();
   }catch(Exception e){throw new RuntimeException(e);}});
   assertTrue(device.wait(Until.hasObject(By.textContains("HEWERS · Offline attendance")),15000));
   device.findObject(By.clazz("android.widget.EditText")).setText("No mobile signal at the sample site");
   device.findObject(By.text("Record time in")).click();
   assertTrue(device.wait(Until.hasObject(By.text("Save on phone")),5000));device.findObject(By.text("Save on phone")).click();
   assertTrue(device.wait(Until.hasObject(By.textContains("1 awaiting sync")),10000));
   String encrypted=context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).getString("queue","");assertFalse(encrypted.isEmpty());assertFalse(encrypted.contains("sample-worker"));assertFalse(encrypted.contains("No mobile signal"));
   // Reopen through a new log instance to exercise encrypted persistence, not in-memory state.
   scenario.onActivity(activity->{LinearLayout panel=new LinearLayout(activity);panel.setOrientation(LinearLayout.VERTICAL);ScrollView container=new ScrollView(activity);container.addView(panel);((ViewGroup)activity.findViewById(android.R.id.content)).addView(container,new ViewGroup.LayoutParams(-1,-1));OfflineAttendance reopened=new OfflineAttendance(activity);reopened.attach(panel);reopened.setContainer(container);reopened.open();});
   assertTrue(device.wait(Until.hasObject(By.textContains("1 awaiting sync")),10000));
   device.takeScreenshot(new File(context.getExternalFilesDir(null),"android-offline-encrypted-log.png"));
  }finally{device.executeShellCommand("svc wifi enable");device.executeShellCommand("svc data enable");context.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE).edit().clear().commit();}
 }
}
