import React from "react";

type Props = {
  location: string;
};

export default function LocationBanner({ location }: Props) {
  return (
    <div className="w-full bg-blue-100 text-blue-900 text-center py-2 font-semibold shadow">
      Kiosk Location: {location}
    </div>
  );
}
