import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useEffect, useMemo, useState } from "react";
import Frame from "react-frame-component";
import { LoaderCircle } from "lucide-react";

interface TicketEditorProps {
  ticket: {
    detail: string;
    fromImap: boolean;
    locked: boolean;
  };
  status: string;
  onContentChange: (document: PartialBlock[]) => void;
}

export default function TicketEditor({
  ticket,
  status,
  onContentChange,
}: TicketEditorProps) {
  const [initialContent, setInitialContent] = useState<
    PartialBlock[] | undefined | "loading"
  >("loading");

  const editor = useMemo(() => {
    if (initialContent === "loading") {
      return undefined;
    }
    return BlockNoteEditor.create({ initialContent });
  }, [initialContent]);

  async function loadFromStorage() {
    try {
      return JSON.parse(ticket.detail as string) as PartialBlock[];
    } catch (_e) {
      return undefined;
    }
  }

  async function convertHTML() {
    if (!editor) return;
    const blocks = (await editor.tryParseHTMLToBlocks(
      ticket.detail
    )) as PartialBlock[];
    editor.replaceBlocks(editor.document, blocks);
  }

  useEffect(() => {
    if (status === "success" && ticket) {
      loadFromStorage().then((content) => {
        if (typeof content === "object") {
          setInitialContent(content);
        } else {
          setInitialContent(undefined);
        }
      });
    }
  }, [status, ticket]);

  useEffect(() => {
    if (initialContent === undefined) {
      convertHTML();
    }
  }, [initialContent]);

  if (editor === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  const handleInputChange = () => {
    if (ticket.locked) return;
    onContentChange(editor.document as PartialBlock[]);
  };

  if (ticket.fromImap) {
    return (
      <div className="py-3 xl:pb-0 xl:pt-2">
        <div className="prose max-w-none mt-2">
          <div>
            <div className="break-words bg-white rounded-md text-black">
              <Frame
                className="min-h-[60vh] h-full max-h-[80vh] overflow-y-auto w-full"
                initialContent={ticket.detail}
              >
                <></>
              </Frame>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 xl:pb-0 xl:pt-2">
      <div className="prose max-w-none mt-2">
        <BlockNoteView
          editor={editor}
          sideMenu={false}
          className="m-0 p-0 bg-transparent dark:text-white"
          onChange={handleInputChange}
          editable={!ticket.locked}
        />
      </div>
    </div>
  );
}
