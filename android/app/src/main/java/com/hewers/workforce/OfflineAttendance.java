package com.hewers.workforce;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.widget.*;
import android.webkit.CookieManager;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/** Private encrypted manual log. No face templates or passwords are cached. */
final class OfflineAttendance {
 private final MainActivity activity;
 private final android.content.SharedPreferences store;
 private final AtomicBoolean syncing=new AtomicBoolean(false);
 private LinearLayout panel;private View container;
 void setContainer(View view){container=view;}
 private JSONObject roster;private String displayedUser="",displayedOwner="";
 OfflineAttendance(MainActivity activity){this.activity=activity;store=activity.getSharedPreferences("offline-attendance",Context.MODE_PRIVATE);}
 private javax.crypto.SecretKey key() throws Exception {
  KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias="hewers-offline-v1";
  if(!keys.containsAlias(alias)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}
  return (javax.crypto.SecretKey)keys.getKey(alias,null);
 }
 private synchronized String read(String name,String fallback) throws Exception {
  String raw=store.getString(name,null);if(raw==null)return fallback;String[] parts=raw.split(":");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
  return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
 }
 private synchronized void write(String name,String value) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String encrypted=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!store.edit().putString(name,encrypted).commit())throw new IOException("Device storage is full");
 }
 synchronized void cache(JSONObject value){try{
  String role=value.optString("role");if(!role.equals("administrator")&&!role.equals("auditor")&&!role.equals("supervisor")){clearRoster();return;}
  JSONArray queue=new JSONArray(read("queue","[]")),kept=new JSONArray(),reviewed=value.optJSONArray("reviewedIds");
  for(int i=0;i<queue.length();i++){JSONObject entry=queue.getJSONObject(i);boolean done=false;if(reviewed!=null)for(int j=0;j<reviewed.length();j++)if(reviewed.getString(j).equals(entry.getString("id")))done=true;if(!done)kept.put(entry);}write("queue",kept.toString());
  value.put("cachedAt",System.currentTimeMillis());write("roster",value.toString());roster=value;
 }catch(Exception e){message("Offline worker list could not be saved. Free some device storage and reconnect.");}}
 synchronized void clearRoster(){roster=null;store.edit().remove("roster").apply();}
 void attach(LinearLayout view){panel=view;}
 private void message(String text){activity.runOnUiThread(()->Toast.makeText(activity,text,Toast.LENGTH_LONG).show());}
 private TextView text(String value,int size){TextView v=new TextView(activity);v.setText(value);v.setTextSize(size);v.setTextColor(Color.rgb(0,36,72));v.setPadding(12,10,12,10);panel.addView(v);return v;}
 private Button button(String label,Runnable action){Button b=new Button(activity);b.setText(label);b.setAllCaps(false);b.setContentDescription(label);b.setOnClickListener(v->action.run());panel.addView(b);return b;}
 void open(){activity.runOnUiThread(()->{
  panel.removeAllViews();panel.setVisibility(View.VISIBLE);if(container!=null)container.setVisibility(View.VISIBLE);text("HEWERS · Offline attendance",24);text("Manual entries · Pending administrator approval. Device time is recorded in Philippine Time. This log does not verify faces.",15);
  try{
   synchronized(this){roster=new JSONObject(read("roster","{}"));}
   displayedUser=roster.optString("userId");displayedOwner=roster.optString("owner");
   JSONArray queue=new JSONArray(read("queue","[]"));int pending=0;for(int i=0;i<queue.length();i++)if(!queue.getJSONObject(i).optBoolean("synced"))pending++;text(pending+" awaiting sync · "+(queue.length()-pending)+" awaiting approval",16);
   button("Sync now",this::sync);
   boolean fresh=roster.optLong("cachedAt")>System.currentTimeMillis()-7L*86400000;
   if(!fresh||!roster.has("userId")){text("Sign in online once to refresh your authorized worker list. Offline lists expire after 7 days. Saved entries stay encrypted on this phone.",16);}
   else{
    text("Recording as "+roster.optString("actor")+" · Last online "+format(Instant.ofEpochMilli(roster.optLong("cachedAt")).toString()),15);
    JSONArray workers=roster.getJSONArray("workers");String[] names=new String[workers.length()];for(int i=0;i<names.length;i++)names[i]=workers.getJSONObject(i).getString("name")+" · "+workers.getJSONObject(i).optString("site");
    if(names.length==0)text("No active assigned workers are available. Reconnect to refresh.",16);
    else{
     Spinner worker=new Spinner(activity);worker.setAdapter(new ArrayAdapter<>(activity,android.R.layout.simple_spinner_dropdown_item,names));panel.addView(worker);
     EditText reason=new EditText(activity);reason.setHint("Reason / supervisor reference (10–500 characters)");reason.setSingleLine(false);panel.addView(reason);
     button("Record time in",()->confirm(workers,worker.getSelectedItemPosition(),"in",reason.getText().toString().trim()));
     button("Record time out",()->confirm(workers,worker.getSelectedItemPosition(),"out",reason.getText().toString().trim()));
    }
   }
   for(int i=0;i<queue.length();i++){JSONObject event=queue.getJSONObject(i);if(!event.optString("userId").equals(roster.optString("userId"))||!event.optString("owner").equals(roster.optString("owner")))continue;text(event.optString("workerName")+" · Time "+event.optString("type")+" · "+format(event.optString("occurredAt"))+"\n"+event.optString("syncError",event.optBoolean("synced")?"Synced · pending administrator approval":"Pending sync"),14);}
  }catch(Exception e){text("Offline storage could not be opened. Do not clear app data or uninstall while entries are pending. Reconnect and contact your administrator.",16);}
  button("Back to website",()->{panel.setVisibility(View.GONE);if(container!=null)container.setVisibility(View.GONE);activity.reloadWorkspace();});
 });}
 private String format(String instant){try{return java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a").withZone(java.time.ZoneId.of("Asia/Manila")).format(Instant.parse(instant))+" PHT";}catch(Exception e){return instant;}}
 private void confirm(JSONArray workers,int index,String type,String reason){
  if(reason.length()<10||reason.length()>500){message("Explain the offline entry using 10–500 characters.");return;}
  try{JSONObject worker=workers.getJSONObject(index);new AlertDialog.Builder(activity).setTitle("Record time "+type+"?").setMessage(worker.getString("name")+"\n"+format(Instant.now().toString())+"\nManual entry, subject to administrator approval.").setNegativeButton("Cancel",null).setPositiveButton("Save on phone",(d,w)->save(worker,type,reason)).show();}catch(Exception e){message("Select a worker.");}
 }
 private synchronized void save(JSONObject worker,String type,String reason){try{
  JSONObject current=new JSONObject(read("roster","{}"));if(!current.optString("userId").equals(displayedUser)||!current.optString("owner").equals(displayedOwner)||current.optLong("cachedAt")<System.currentTimeMillis()-7L*86400000)throw new IOException("Refresh the worker list online before recording");
  boolean assigned=false;JSONArray authorized=current.getJSONArray("workers");for(int i=0;i<authorized.length();i++)if(authorized.getJSONObject(i).getString("id").equals(worker.getString("id")))assigned=true;if(!assigned)throw new IOException("This worker is no longer on the cached authorized list");
  JSONArray queue=new JSONArray(read("queue","[]"));if(queue.length()>=1000)throw new IOException("Sync existing entries before adding more");
  boolean open=worker.optBoolean("open");
  for(int i=0;i<queue.length();i++){JSONObject e=queue.getJSONObject(i);if(e.optString("workerId").equals(worker.getString("id"))&&e.optString("owner").equals(current.getString("owner"))&&e.optString("userId").equals(current.getString("userId")))open=e.getString("type").equals("in");}
  if((type.equals("in")&&open)||(type.equals("out")&&!open))throw new IOException(type.equals("in")?"A time-in already exists. Record time-out or reconnect to review.":"Record the worker’s time-in first, or reconnect to refresh their attendance.");
  JSONObject event=new JSONObject().put("id",UUID.randomUUID().toString()).put("owner",current.getString("owner")).put("userId",current.getString("userId")).put("workerId",worker.getString("id")).put("workerName",worker.getString("name")).put("type",type).put("occurredAt",Instant.now().toString()).put("reason",reason).put("schedule",worker.getJSONObject("schedule"));
  queue.put(event);write("queue",queue.toString());message("Saved on phone · pending sync and approval");open();sync();
 }catch(Exception e){message(e.getMessage()==null?"Could not save on device. Try again.":e.getMessage());}}
 void sync(){if(!syncing.compareAndSet(false,true))return;
  new Thread(()->{boolean updated=false;try{
   JSONArray copy; synchronized(this){copy=new JSONArray(read("queue","[]"));}
   for(int i=0;i<copy.length();i++){
    JSONObject event=copy.getJSONObject(i);if(event.optBoolean("synced"))continue;
    JSONObject active; synchronized(this){active=new JSONObject(read("roster","{}"));}if(!event.optString("userId").equals(active.optString("userId"))||!event.optString("owner").equals(active.optString("owner")))continue;
    String cookie=CookieManager.getInstance().getCookie(AppPolicy.HOME);if(cookie==null)break;
    HttpURLConnection connection=(HttpURLConnection)new URL(AppPolicy.ORIGIN+"/api/offline-attendance").openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Cookie",cookie);connection.setRequestProperty("Origin",AppPolicy.ORIGIN);connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("x-workspace-id",event.getString("owner"));
    try{
     try(OutputStream out=connection.getOutputStream()){out.write(event.toString().getBytes(StandardCharsets.UTF_8));}
     int status=connection.getResponseCode();String result;try(InputStream in=status<400?connection.getInputStream():connection.getErrorStream()){if(in==null)throw new IOException();ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>65536)throw new IOException();}result=bytes.toString("UTF-8");}
     JSONObject body=new JSONObject(result);boolean saved=status==200&&body.optBoolean("ok")&&body.optString("id").equals(event.getString("id"));
     synchronized(this){JSONArray current=new JSONArray(read("queue","[]")),next=new JSONArray();for(int j=0;j<current.length();j++){JSONObject entry=current.getJSONObject(j);if(entry.getString("id").equals(event.getString("id"))){if(saved){entry.put("synced",true);entry.remove("syncError");}else entry.put("syncError",body.optString("error","Sync failed; retry after reconnecting"));}next.put(entry);}write("queue",next.toString());}
     updated=true;if(!saved)break;
    }finally{connection.disconnect();}
   }
  }catch(Exception e){/* Keep all unacknowledged events for the next resume/reconnection. */}
  finally{syncing.set(false);if(updated)activity.runOnUiThread(()->{if(panel!=null&&panel.getVisibility()==View.VISIBLE&&!(activity.getCurrentFocus() instanceof EditText))open();});}
  },"hewers-offline-sync").start();
 }
 boolean close(){if(panel!=null&&panel.getVisibility()==View.VISIBLE){panel.setVisibility(View.GONE);if(container!=null)container.setVisibility(View.GONE);return true;}return false;}
}
