import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function CustomerBirthdayReminderPage() {
  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-slate-900">Birthday Reminder</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-700">
          Halaman ini akan digunakan untuk reminder ulang tahun customer.
        </p>
      </CardContent>
    </Card>
  );
}
