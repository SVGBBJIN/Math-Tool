"use client";
import { useActionState } from "react";
import { createStudent, updateSettings as serverUpdate, type FormState } from "../../actions/account";
import { FormMessage } from "@/components/FormMessage";

export function HouseholdForm(props: {
  disabled: boolean;
  timezone: string;
  amcDate: string;
  finalsStart: string;
  finalsEnd: string;
  /** Defaults to the signed-in server action; guest mode saves to the browser instead. */
  action?: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(props.action ?? serverUpdate, {});
  return (
    <form action={action} className="mt-3 space-y-3">
      <fieldset disabled={props.disabled} className="space-y-3">
        <div>
          <label className="label" htmlFor="timezone">Time zone (IANA)</label>
          <input id="timezone" name="timezone" className="input" defaultValue={props.timezone} required />
        </div>
        <div>
          <label className="label" htmlFor="amcDate">AMC 10 date</label>
          <input id="amcDate" name="amcDate" type="date" className="input" defaultValue={props.amcDate} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="finalsStart">Honors Math finals start</label>
            <input id="finalsStart" name="finalsStart" type="date" className="input" defaultValue={props.finalsStart} />
          </div>
          <div>
            <label className="label" htmlFor="finalsEnd">Finals end</label>
            <input id="finalsEnd" name="finalsEnd" type="date" className="input" defaultValue={props.finalsEnd} />
          </div>
        </div>
        {!props.disabled && <button className="btn w-full" disabled={pending}>Save</button>}
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}

export function StudentForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createStudent, {});
  return (
    <form action={action} className="mt-3 space-y-3">
      <p className="text-sm text-muted">Create your student&apos;s login. You own this account and its phone numbers.</p>
      <div>
        <label className="label" htmlFor="sName">Student&apos;s name</label>
        <input id="sName" name="displayName" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="sEmail">Login email</label>
        <input id="sEmail" name="email" type="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="sPassword">Password</label>
        <input id="sPassword" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" />
      </div>
      <button className="btn w-full" disabled={pending}>Create student login</button>
      <FormMessage state={state} />
    </form>
  );
}
