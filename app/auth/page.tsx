'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function AuthPage(){
 const [email,setEmail]=useState('demo@quanlytaichinh.vn'); const [password,setPassword]=useState('123456'); const [name,setName]=useState(''); const [mode,setMode]=useState<'login'|'register'>('login'); const [msg,setMsg]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault(); const sb=createClient();
  // Demo local: tài khoản demo cho phép vào ngay không cần Supabase. Bản deploy dùng Supabase Auth thật.
  if(email==='demo@quanlytaichinh.vn'&&password==='123456'){setMsg('Đăng nhập demo thành công. Đang chuyển tới Dashboard…'); location.href='/dashboard'; return;}
  if(mode==='register'){const {error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}}); setMsg(error?('Lỗi: '+error.message):'Đăng ký thành công, kiểm tra email để xác nhận (tắt Confirm email ở Supabase lúc test để đăng nhập nhanh).');}
  else{const {error}=await sb.auth.signInWithPassword({email,password}); if(error) setMsg('Sai email/mật khẩu: '+error.message); else location.href='/dashboard';}
 }
 return(<main className="glass"><h1>{mode==='login'?'Đăng nhập':'Đăng ký'}</h1><form onSubmit={submit} style={{display:'grid',gap:12}}>
  {mode==='register'&&<input placeholder="Họ tên" value={name} onChange={e=>setName(e.target.value)} required/>}
  <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
  <input placeholder="Mật khẩu (tối thiểu 6 ký tự)" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
  <button> {mode==='login'?'Đăng nhập':'Đăng ký'} </button></form>
  <p><a href="#" onClick={e=>{e.preventDefault();setMode(mode==='login'?'register':'login')}}>{mode==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập'}</a></p>
  <p>{msg}</p><p><a href="#" onClick={async e=>{e.preventDefault(); const sb=createClient(); const {error}=await sb.auth.resetPasswordForEmail(email); setMsg(error?error.message:'Đã gửi link đặt lại mật khẩu (cần cấu hình Site URL ở Supabase).');}}>Quên mật khẩu?</a></p></main>);
}
