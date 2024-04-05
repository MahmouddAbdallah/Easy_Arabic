import Table from "./component/Table";
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function Home() {
  const token = cookies().get('token')

  if (!token) {
    redirect('/sign-in')
  }
  return (
    <div >
      <Table />
    </div>
  );
}
