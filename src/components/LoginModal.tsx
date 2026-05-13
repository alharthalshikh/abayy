"use client";
import { useState } from "react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="auth-container">
          <div className="auth-header">
            <h2>{isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h2>
            <p>{isRegister ? "انضمي إلينا لتجربة تسوق فريدة" : "مرحباً بكِ مجدداً في أثير"}</p>
          </div>

          <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
            {isRegister && (
              <div className="form-group">
                <label>الاسم بالكامل</label>
                <input 
                  type="text" 
                  placeholder="أدخلِ اسمكِ" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
            )}
            
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input 
                type="email" 
                placeholder="example@mail.com" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>كلمة المرور</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            {!isRegister && (
              <div className="forgot-pass">
                <a href="#">نسيتِ كلمة المرور؟</a>
              </div>
            )}

            <button type="submit" className="btn-auth">
              {isRegister ? "إنشاء الحساب" : "دخول"}
            </button>
          </form>

          <div className="auth-divider">
            <span>أو</span>
          </div>

          <div className="auth-social">
            <button className="btn-google">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google" />
              متابعة باستخدام جوجل
            </button>
          </div>

          <div className="auth-footer">
            <p>
              {isRegister ? "لديكِ حساب بالفعل؟" : "ليس لديكِ حساب؟"}
              <button onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? "تسجيل الدخول" : "إنشاء حساب جديد"}
              </button>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.3s ease;
        }

        .modal-content {
          background: #fff;
          width: 100%;
          max-width: 450px;
          padding: 40px;
          border-radius: 24px;
          position: relative;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: slideUp 0.4s ease;
        }

        .modal-close {
          position: absolute;
          top: 20px;
          left: 20px;
          background: #f5f5f5;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          background: #eee;
          transform: rotate(90deg);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-header h2 {
          font-size: 28px;
          font-weight: 800;
          color: #0c0c0c;
          margin-bottom: 8px;
        }

        .auth-header p {
          color: #888;
          font-size: 15px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .form-group input {
          padding: 14px 18px;
          border: 1px solid #eee;
          border-radius: 12px;
          font-size: 15px;
          transition: all 0.3s ease;
          background: #fafafa;
        }

        .form-group input:focus {
          border-color: #c8a96e;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(200, 169, 110, 0.1);
          outline: none;
        }

        .forgot-pass {
          text-align: left;
        }

        .forgot-pass a {
          font-size: 13px;
          color: #c8a96e;
          font-weight: 600;
        }

        .btn-auth {
          background: #c8a96e;
          color: #fff;
          border: none;
          padding: 16px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 10px;
        }

        .btn-auth:hover {
          background: #9e834a;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(200, 169, 110, 0.3);
        }

        .auth-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: #ddd;
        }

        .auth-divider::before, .auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #eee;
        }

        .auth-divider span {
          padding: 0 15px;
          font-size: 14px;
          color: #aaa;
        }

        .btn-google {
          width: 100%;
          padding: 14px;
          border: 1px solid #eee;
          border-radius: 12px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-google:hover {
          background: #fafafa;
          border-color: #ddd;
        }

        .btn-google img {
          width: 20px;
        }

        .auth-footer {
          margin-top: 32px;
          text-align: center;
        }

        .auth-footer p {
          font-size: 14px;
          color: #666;
        }

        .auth-footer button {
          background: none;
          border: none;
          color: #c8a96e;
          font-weight: 700;
          cursor: pointer;
          margin-right: 5px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
