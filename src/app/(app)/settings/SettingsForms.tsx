"use client";
import { useActionState } from "react";
import { updateSettings, type FormState } from "../../actions/account";
import { FormMessage } from "@/components/FormMessage";

export function SettingsForm(props: { timezone: string; amcDate: string; finalsStart: string; finalsEnd: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSettings, {});
  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="space-y-3">
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
        <button className="btn w-full" disabled={pending}>Save</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
