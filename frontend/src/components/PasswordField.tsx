import { useState, type Ref } from "react";

interface PasswordFieldProps {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

export default function PasswordField({
  label,
  name,
  value,
  onChange,
  inputRef,
  autoComplete = "new-password",
  minLength,
  required
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="password-wrap">
        <input
          ref={inputRef}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((prev) => !prev)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
