import dynamic from "next/dynamic";

const Editor = dynamic(() => import("../../components/NotebookEditor"), {
  ssr: false,
});

export default function Notebooks() {

  return (
    <>
      <Editor />
    </>
  );
}
