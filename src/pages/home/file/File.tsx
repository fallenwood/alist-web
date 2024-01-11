import { HStack, VStack } from "@hope-ui/solid"
import { createMemo, createSignal, Show, Suspense } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Badge } from "@hope-ui/solid"
import { FullLoading, SelectWrapper } from "~/components"
import { objStore } from "~/store"
import { Download } from "../previews/download"
import { OpenWith } from "./open-with"
import { getPreviews } from "../previews"
import axios from "axios"

const fetchVisits = async (filename: string) => {
  try {
    const response = await axios.post(
      `/danmakuhub/visit?filename=${encodeURIComponent(filename)}`,
    )
    return response.data.visits
  } catch {
    return -1
  }
}

const File = () => {
  const previews = createMemo(() => {
    return getPreviews({ ...objStore.obj, provider: objStore.provider })
  })
  const [cur, setCur] = createSignal(previews()[0])
  const [visits, setVisits] = createSignal(-1)
  fetchVisits(objStore.obj.name).then((v) => setVisits(v))

  return (
    <Show when={previews().length > 1} fallback={<Download openWith />}>
      <VStack w="$full" spacing="$2">
        <div>
          <span>
            历史访问{" "}
            <Badge colorScheme={visits() == -1 ? "danger" : "success"}>
              {visits()}
            </Badge>
          </span>
        </div>
        <HStack w="$full" spacing="$2">
          <SelectWrapper
            alwaysShowBorder
            value={cur().name}
            onChange={(name) => {
              setCur(previews().find((p) => p.name === name)!)
            }}
            options={previews().map((item) => ({ value: item.name }))}
          />
          <OpenWith />
        </HStack>
        <Suspense fallback={<FullLoading />}>
          <Dynamic component={cur().component} />
        </Suspense>
      </VStack>
    </Show>
  )
}

export default File
