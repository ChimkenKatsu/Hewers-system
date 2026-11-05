package com.hewers.workforce;

import android.Manifest;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public class MainActivity extends ComponentActivity {
    private static final int CAMERA = 10, PHOTO = 11, EXPORT = 12, NOTIFICATIONS = 13;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> photoCallback;
    private PermissionRequest pendingCamera;
    private byte[] pendingExport;
    private boolean mainFrameFailed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        HewersMessagingService.createChannel(this);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(0,36,72)); setContentView(root);
        root.setOnApplyWindowInsetsListener((v, insets) -> { if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()); v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());} return insets; });
        web = new WebView(this); root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        web.setBackgroundColor(Color.rgb(242,244,245));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString()+" HewersAndroid/0.2.0");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal); progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(244,171,2))); root.addView(progress,new FrameLayout.LayoutParams(-1,dp(4),Gravity.TOP));
        errorPanel = new LinearLayout(this); errorPanel.setOrientation(LinearLayout.VERTICAL); errorPanel.setGravity(Gravity.CENTER); errorPanel.setPadding(dp(28),dp(28),dp(28),dp(28)); errorPanel.setBackgroundColor(Color.rgb(242,244,245));
        TextView connectionMessage = new TextView(this); connectionMessage.setText("Hewers cannot connect right now.\n\nCheck your connection, then try again. Saved drafts remain on this device."); connectionMessage.setTextColor(Color.rgb(0,36,72)); connectionMessage.setTextSize(17); connectionMessage.setGravity(Gravity.CENTER); errorPanel.addView(connectionMessage);
        Button retry = new Button(this); retry.setText("Try again"); retry.setOnClickListener(v -> {errorPanel.setVisibility(View.GONE); web.reload();}); errorPanel.addView(retry); errorPanel.setVisibility(View.GONE); root.addView(errorPanel,new FrameLayout.LayoutParams(-1,-1));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { String url=request.getUrl().toString(); if(!request.isForMainFrame())return !AppPolicy.isAppUrl(url); if(AppPolicy.isAppUrl(url))return false; openExternal(url);return true; }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { mainFrameFailed=false; progress.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView view,String url) { progress.setVisibility(View.GONE); CookieManager.getInstance().flush(); if(!mainFrameFailed)errorPanel.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) { if(request.isForMainFrame()){mainFrameFailed=true;errorPanel.setVisibility(View.VISIBLE);} }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error) { handler.cancel();mainFrameFailed=true;errorPanel.setVisibility(View.VISIBLE); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view,int value) {progress.setProgress(value);}
            @Override public void onPermissionRequest(PermissionRequest request) { runOnUiThread(() -> { if(!AppPolicy.isAppUrl(request.getOrigin().toString())||!AppPolicy.isAppUrl(web.getUrl())||!AppPolicy.cameraOnly(request.getResources())){request.deny();return;} if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else{if(pendingCamera!=null)pendingCamera.deny();pendingCamera=request;requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA);} }); }
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(pendingCamera==request)pendingCamera=null;}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) { if(!AppPolicy.isAppUrl(view.getUrl()))return false;if(photoCallback!=null)photoCallback.onReceiveValue(null);photoCallback=callback;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("image/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});try{startActivityForResult(intent,PHOTO);}catch(ActivityNotFoundException e){photoCallback.onReceiveValue(null);photoCallback=null;toast("No photo picker is available on this phone.");}return true; }
            @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean userGesture,android.os.Message resultMsg) { if(!userGesture)return false;WebView popup=new WebView(MainActivity.this);popup.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){openExternal(r.getUrl().toString());v.destroy();return true;}});((WebView.WebViewTransport)resultMsg.obj).setWebView(popup);resultMsg.sendToTarget();return true; }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"HewersDownloads",Collections.singleton(AppPolicy.ORIGIN),(view,message,source,isMainFrame,reply)->{if(!isMainFrame||!AppPolicy.isAppUrl(source.toString())||!AppPolicy.isAppUrl(web.getUrl()))return;try{JSONObject value=new JSONObject(message.getData());String text=value.getString("text"),name=AppPolicy.downloadName(value.getString("name"));if(text.getBytes(StandardCharsets.UTF_8).length>2*1024*1024){toast("This export is too large. Download it in your browser.");return;}if(pendingExport!=null){toast("Finish saving the current file first.");return;}pendingExport=text.getBytes(StandardCharsets.UTF_8);Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(name.endsWith(".csv")?"text/csv":"text/plain");intent.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(intent,EXPORT);}catch(Exception e){pendingExport=null;toast("The file could not be prepared. Try again.");}});
        web.setDownloadListener((url,agent,disposition,mime,length)->toast("Use the export button. If unavailable, update Android System WebView or open Hewers in your browser."));
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"HewersPush",Collections.singleton(AppPolicy.ORIGIN),(view,message,source,isMainFrame,reply)->{
            if(!isMainFrame||!AppPolicy.isAppUrl(source.toString())||!AppPolicy.isAppUrl(web.getUrl())||!"register".equals(message.getData()))return;
            if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
                if(!getPreferences(MODE_PRIVATE).getBoolean("notificationPermissionAsked",false)){
                    getPreferences(MODE_PRIVATE).edit().putBoolean("notificationPermissionAsked",true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATIONS);
                }
                return;
            }
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{
                if(!isFinishing()&&AppPolicy.isAppUrl(web.getUrl())){try{reply.postMessage(new JSONObject().put("token",token).toString());}catch(Exception ignored){/* Page may have navigated. Next sync retries. */}}
            });
        });
        if(getIntent().getBooleanExtra("openNotifications",false))web.loadUrl(AppPolicy.HOME+"?notifications=1");
        else if(state==null||web.restoreState(state)==null)web.loadUrl(AppPolicy.HOME);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){goBack();}});
    }
    private int dp(int value){return (int)(value*getResources().getDisplayMetrics().density);}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(intent.getBooleanExtra("openNotifications",false)&&web!=null)web.loadUrl(AppPolicy.HOME+"?notifications=1");}
    private void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    private void openExternal(String raw){if(!AppPolicy.isExternalHttps(raw))return;try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(raw)));}catch(ActivityNotFoundException e){toast("Install a browser to open this link.");}}
    private void goBack(){if(web.canGoBack())web.goBack();else moveTaskToBack(true);}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==NOTIFICATIONS&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&AppPolicy.isAppUrl(web.getUrl()))web.evaluateJavascript("window.dispatchEvent(new Event('hewers-push-ready'))",null);if(code==CAMERA&&pendingCamera!=null){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&AppPolicy.isAppUrl(web.getUrl()))pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else pendingCamera.deny();pendingCamera=null;}}
    @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(code==PHOTO&&photoCallback!=null){Uri uri=result==RESULT_OK&&data!=null?data.getData():null;String type=uri!=null?getContentResolver().getType(uri):null;photoCallback.onReceiveValue(uri!=null&&"content".equals(uri.getScheme())&&type!=null&&(type.equals("image/jpeg")||type.equals("image/png")||type.equals("image/webp"))?new Uri[]{uri}:null);photoCallback=null;}if(code==EXPORT){byte[] bytes=pendingExport;pendingExport=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new java.io.IOException();out.write(bytes);toast("File saved.");}catch(Exception e){toast("The file could not be saved. Try exporting again.");}}}}
    @Override protected void onSaveInstanceState(Bundle out){web.saveState(out);super.onSaveInstanceState(out);}
    @Override protected void onPause(){web.onPause();CookieManager.getInstance().flush();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(photoCallback!=null)photoCallback.onReceiveValue(null);if(pendingCamera!=null)pendingCamera.deny();if(web!=null){web.stopLoading();web.destroy();}pendingExport=null;super.onDestroy();}
}
