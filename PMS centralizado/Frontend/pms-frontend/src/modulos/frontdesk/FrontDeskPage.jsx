import useRoomsCompat from "./RoomsAdapter";
export default function FrontDeskPage({ rooms: legacyRooms = [] }) {
  const rooms = useRoomsCompat(legacyRooms);
  // ...render igual que siempre
}


export default function FrontDeskPage() {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold">Módulo: Front Desk</h1>
        <p><link rel="stylesheet" href="" /> <Layout className="jsx"></Layout>        
        .</p>
      </div>
    );
  }
                 