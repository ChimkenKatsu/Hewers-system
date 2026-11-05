package com.hewers.workforce;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** Data-only messages keep lock-screen content generic and routes fixed to Hewers. */
public class HewersMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL = "hewers_requests";
    public static void createChannel(android.content.Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Hewers notifications", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Worker approvals and missing time-out reminders");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        String kind = message.getData().get("kind"), event = message.getData().get("eventId");
        if (event == null || event.length() > 180 || !("submitted".equals(kind) || "accepted".equals(kind) || "declined".equals(kind) || "missing-timeout".equals(kind))) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        createChannel(this);
        Intent intent = new Intent(this, MainActivity.class).putExtra("openNotifications", true).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = "missing-timeout".equals(kind) ? "Worker has not timed out" : "submitted".equals(kind) ? "Worker request needs review" : "Worker request updated";
        Notification notification = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.notification_icon).setContentTitle(title)
            .setContentText("Open Hewers to view the latest details.")
            .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).setContentIntent(tap).build();
        getSystemService(NotificationManager.class).notify(event, 0, notification);
    }
}
